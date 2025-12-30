import OpenAI from "openai";
import { ExtractedInvoiceData, ExtractedInvoiceSchema } from "@/types/invoice";
import { VendorTemplate } from "@prisma/client";
import { buildDynamicSchema, getCustomFieldDefinitions } from "./schema-builder";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  template?: VendorTemplate | null
): Promise<ExtractedInvoiceData> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  try {
    // Build prompt with template customizations
    const prompt = buildExtractionPrompt(template);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost-effective model: ~60-80% cheaper than GPT-4 Turbo
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: `Extract data from this invoice/receipt:\n\n${pdfText}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for consistent, factual extraction
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse and validate the JSON response with dynamic schema
    const parsedData = JSON.parse(content);
    const schema = buildDynamicSchema(template);
    const validatedData = schema.parse(parsedData);

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
