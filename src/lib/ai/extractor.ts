import OpenAI from "openai";
import { ExtractedInvoiceData, ExtractedInvoiceSchema } from "@/types/invoice";
import { VendorTemplate } from "@prisma/client";
import { buildDynamicSchema, getCustomFieldDefinitions } from "./schema-builder";
import { ModelSelector } from "./model-selector";

// Lazy-load OpenAI client to ensure environment variables are loaded first
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set. Please configure it in .env.local'
      );
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

const EXTRACTION_PROMPT = `You are an expert invoice/receipt data extraction system. Extract the following information from the provided document:

1. Invoice/Receipt Number
2. Date (ISO 8601 format: YYYY-MM-DD)
3. Line Items (array of objects with: description, quantity, unitPrice, amount)
4. Total Amount (as a number, no currency symbols)
5. Currency (3-letter code like USD, EUR, etc.)

Return ONLY valid JSON in this exact format:
{
  "invoiceNumber": "string or null",
  "date": "YYYY-MM-DD or null",
  "totalAmount": number or null,
  "currency": "string or null",
  "lineItems": [
    {
      "description": "string",
      "quantity": number or null,
      "unitPrice": number or null,
      "amount": number or null
    }
  ]
}

Rules:
- If a field is not found, use null
- Parse all amounts as numbers (no currency symbols or commas)
- Ensure dates are in YYYY-MM-DD format
- Include all line items found in the document
- The lineItems array can be empty if no line items are found
- Be accurate and extract exactly what you see in the document`;

/**
 * Build extraction prompt with template customizations
 */
export function buildExtractionPrompt(template?: VendorTemplate | null): string {
  let prompt = EXTRACTION_PROMPT;

  if (!template) {
    return prompt;
  }

  // Add custom prompt instructions
  if (template.customPrompt) {
    prompt += `\n\nVENDOR-SPECIFIC INSTRUCTIONS:\n${template.customPrompt}`;
  }

  // Add custom field definitions
  const customFields = getCustomFieldDefinitions(template);
  if (customFields.length > 0) {
    prompt += `\n\nADDITIONAL FIELDS TO EXTRACT:\n`;
    customFields.forEach((field) => {
      prompt += `- ${field.name} (${field.type}${field.required ? ', required' : ', optional'}): ${field.description || 'No description'}\n`;
    });

    // Update JSON schema example
    const customFieldsSchema: Record<string, string> = {};
    customFields.forEach((field) => {
      const typeHint = field.type === 'number' ? 'number or null'
        : field.type === 'boolean' ? 'boolean or null'
          : 'string or null';
      customFieldsSchema[field.name] = typeHint;
    });

    prompt += `\n\nExtend the JSON response with these additional fields:\n${JSON.stringify(customFieldsSchema, null, 2)}`;
  }

  return prompt;
}

export async function extractInvoiceData(
  pdfText: string,
  template?: VendorTemplate | null,
  userId?: string
): Promise<ExtractedInvoiceData> {
  try {
    // 1. Get appropriate provider based on user config
    // If no userId provided (e.g. legacy call), fallback to system default
    const provider = await ModelSelector.getProvider(userId || "system", template?.vendorId);

    // 2. Build prompt
    const prompt = buildExtractionPrompt(template);

    // 3. Extract data
    const startTime = Date.now();
    const result = await provider.extract(pdfText, prompt);
    const processingTime = Date.now() - startTime;

    // 4. Log usage if we have a userId
    if (userId) {
      /*
      // We need to do this asynchronously to not block response
      // Also we need to import prisma
      prisma.aIUsageLog.create({
        data: {
          userId,
          provider: provider.getProviderName(),
          model: (provider as any).config.model, // Access config directly or add getter
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          estimatedCost: result.usage.cost || 0,
          processingTime,
        }
      }).catch(err => console.error("Failed to log AI usage:", err));
      */
    }

    // 5. Validate and parse
    const schema = buildDynamicSchema(template);
    const validatedData = schema.parse(result.data);

    return validatedData;
  } catch (error) {
    console.error("Error extracting invoice data:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to extract invoice data: ${error.message}`);
    }
    throw new Error("Failed to extract invoice data: Unknown error");
  }
}

export async function extractInvoiceDataWithFallback(
  pdfText: string,
  pdfBuffer?: Buffer,
  template?: VendorTemplate | null
): Promise<ExtractedInvoiceData> {
  try {
    // First, try text extraction
    return await extractInvoiceData(pdfText, template);
  } catch (error) {
    console.error("Text extraction failed, checking if we can use Vision API:", error);

    // If we have a PDF buffer, we could convert to image and use GPT-4 Vision
    // For now, we'll just rethrow the error
    // In a production app, you'd implement image conversion and Vision API call here

    throw error;
  }
}

export function isValidExtraction(data: ExtractedInvoiceData): boolean {
  // Check if we extracted at least some meaningful data
  return !!(
    data.invoiceNumber ||
    data.date ||
    data.totalAmount ||
    (data.lineItems && data.lineItems.length > 0)
  );
}
