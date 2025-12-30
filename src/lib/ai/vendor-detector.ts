import { prisma } from '@/lib/db/prisma';
import { VendorDetectionResult } from '@/types/vendor';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Detect vendor from PDF text using multiple strategies
 * 1. Identifier matching (fast, free)
 * 2. AI detection (accurate, small cost)
 * 3. Fuzzy matching (fallback)
 */
export async function detectVendorFromText(
  pdfText: string,
  userId: string
): Promise<VendorDetectionResult> {
  // Fetch user's vendors with identifiers
  const vendors = await prisma.vendor.findMany({
    where: { userId },
    include: {
      templates: {
        where: { isActive: true },
      },
    },
  });

  if (vendors.length === 0) {
    return {
      vendorId: null,
      confidence: 0,
      matchReason: 'none',
    };
  }

  // Strategy 1: Try identifier matching first (fast, free)
  const identifierMatch = matchByIdentifiers(pdfText, vendors);
  if (identifierMatch && identifierMatch.confidence > 0.9) {
    return identifierMatch;
  }

  // Strategy 2: Use AI detection (OpenAI API call)
  try {
    const aiDetection = await detectVendorWithAI(pdfText, vendors);
    if (aiDetection && aiDetection.confidence > 0.7) {
      return aiDetection;
    }
  } catch (error) {
    console.error('AI vendor detection failed:', error);
  }

  // Strategy 3: Fuzzy string matching fallback
  const fuzzyMatch = fuzzyMatchVendorName(pdfText, vendors);

  return (
    fuzzyMatch || {
      vendorId: null,
      confidence: 0,
      matchReason: 'none',
    }
  );
}

/**
 * Match vendor by identifiers (e.g., Tax ID, Company Registration)
 */
function matchByIdentifiers(
  pdfText: string,
  vendors: any[]
): VendorDetectionResult | null {
  const textLower = pdfText.toLowerCase();

  for (const vendor of vendors) {
    if (!vendor.identifiers) continue;

    const identifiers = JSON.parse(vendor.identifiers) as string[];

    for (const identifier of identifiers) {
      const identifierLower = identifier.toLowerCase();

      // Check for exact substring match
      if (textLower.includes(identifierLower)) {
        return {
          vendorId: vendor.id,
          confidence: 0.95,
          detectedName: vendor.name,
          matchReason: 'identifier',
        };
      }
    }
  }

  return null;
}

/**
 * Use AI to detect vendor from invoice text
 */
async function detectVendorWithAI(
  pdfText: string,
  vendors: any[]
): Promise<VendorDetectionResult | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY is not configured, skipping AI detection');
    return null;
  }

  const vendorList = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    identifiers: v.identifiers ? JSON.parse(v.identifiers) : [],
  }));

  const prompt = `Given this invoice/receipt text, identify which vendor it's from.

Available vendors:
${JSON.stringify(vendorList, null, 2)}

Analyze the text and determine which vendor issued this invoice. Look for:
- Company name
- Identifiers (tax ID, registration number, etc.)
- Contact information
- Letterhead text

Return JSON with:
- vendorId: The ID of the matching vendor (or null if no match)
- confidence: A number between 0 and 1 indicating confidence
- reason: Brief explanation of why this vendor was matched

Invoice text (first 1500 characters):
${pdfText.substring(0, 1500)}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a vendor detection assistant. Analyze invoice text and identify the vendor.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return null;
  }

  const result = JSON.parse(content);

  return {
    vendorId: result.vendorId || null,
    confidence: result.confidence || 0,
    detectedName: vendors.find((v) => v.id === result.vendorId)?.name,
    matchReason: 'ai',
  };
}

/**
 * Fuzzy match vendor name in text
 */
function fuzzyMatchVendorName(
  pdfText: string,
  vendors: any[]
): VendorDetectionResult | null {
  const textLower = pdfText.toLowerCase();
  const firstPage = pdfText.substring(0, 1000).toLowerCase(); // Focus on first page

  let bestMatch: { vendorId: string; name: string; confidence: number } | null =
    null;

  for (const vendor of vendors) {
    const vendorNameLower = vendor.name.toLowerCase();

    // Check for exact name match
    if (firstPage.includes(vendorNameLower)) {
      return {
        vendorId: vendor.id,
        confidence: 0.8,
        detectedName: vendor.name,
        matchReason: 'fuzzy',
      };
    }

    // Check for partial name match (e.g., "Acme Corp" matches "Acme")
    const words = vendorNameLower.split(' ');
    if (words.length > 1) {
      const significantWords = words.filter((w) => w.length > 3); // Skip short words like "Inc", "Ltd"

      const matchCount = significantWords.filter((word) =>
        firstPage.includes(word)
      ).length;

      const confidence = matchCount / significantWords.length;

      if (
        confidence > 0.5 &&
        (!bestMatch || confidence > bestMatch.confidence)
      ) {
        bestMatch = {
          vendorId: vendor.id,
          name: vendor.name,
          confidence: confidence * 0.7, // Reduce confidence for partial matches
        };
      }
    }
  }

  if (bestMatch) {
    return {
      vendorId: bestMatch.vendorId,
      confidence: bestMatch.confidence,
      detectedName: bestMatch.name,
      matchReason: 'fuzzy',
    };
  }

  return null;
}
