/**
 * Legacy Synchronous Processor
 * Preserved for backward compatibility when WORKER_MODE=disabled
 * This is the ORIGINAL processing logic before background jobs
 */
import { prisma } from "@/lib/db/prisma";
import { parsePDF } from "@/lib/pdf/parser";
import { detectScannedDocument } from "@/lib/pdf/detector";
import { extractInvoiceData, extractInvoiceDataWithVision } from "@/lib/ai/extractor";
import { detectVendorFromText } from "@/lib/ai/vendor-detector";
import { applyFieldMappings, separateStandardAndCustomFields } from "@/lib/ai/field-mapper";
import { applyValidationRules } from "@/lib/ai/schema-builder";
import { getStorageForFile } from "@/lib/storage";

export async function processInvoiceSync(
  invoiceId: string,
  userId: string,
  vendorId?: string,
  options?: {
    useVision?: boolean;
    images?: string[];
  }
) {
  // Get invoice from database and verify ownership
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.userId !== userId) {
    throw new Error('Unauthorized to process this invoice');
  }

  if (!invoice.fileUrl) {
    throw new Error('Invoice file URL not found');
  }

  // Update status to processing and clear any previous errors/line items
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "processing",
      aiResponse: null,
      lineItems: {
        deleteMany: {}, // Clear existing line items on retry
      },
    },
  });

  // Route to Vision processing if requested
  if (options?.useVision && options?.images && options.images.length > 0) {
    console.log(`Processing invoice ${invoiceId} with Vision API (${options.images.length} images)`);
    return await processInvoiceSyncWithVision(invoiceId, userId, options.images, vendorId);
  }

  try {
    // Read PDF file from storage (S3 or local - auto-detected from URL)
    const storage = getStorageForFile(invoice.fileUrl);
    let fileBuffer: Buffer;

    try {
      fileBuffer = await storage.read(invoice.fileUrl);
    } catch (fileError) {
      throw new Error(`Failed to read PDF file: ${fileError instanceof Error ? fileError.message : 'File not found'}`);
    }

    // Extract text from PDF and detect if scanned
    let pdfText: string;
    let numPages: number = 1;
    let textDensity: number | null = null;
    let isScanned = false;

    try {
      const parseResult = await parsePDF(fileBuffer);

      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Failed to parse PDF');
      }

      pdfText = parseResult.text;
      numPages = parseResult.numPages || 1;

      // Detect if document is scanned
      const detection = detectScannedDocument(pdfText, numPages);
      isScanned = detection.isScanned;
      textDensity = detection.textDensity;

      if (isScanned) {
        console.warn(
          `Invoice ${invoiceId}: Scanned document detected (confidence: ${(detection.confidence * 100).toFixed(0)}%)`,
          detection.reasons
        );
      }

      // Even if scanned, we'll try text extraction first
      // User can reprocess with Vision API later if needed
      if (!pdfText || pdfText.trim().length === 0) {
        // Save detection results before failing
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            isScanned: true,
            textDensity: textDensity || 0,
          },
        });
        throw new Error("PDF contains no extractable text. The document may be an image-based scan.");
      }
    } catch (pdfError) {
      // If detection was run, save results before throwing
      if (typeof isScanned !== 'undefined') {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            isScanned: isScanned,
            textDensity: textDensity,
          },
        });
      }
      throw new Error(`PDF text extraction failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
    }

    // Vendor detection and template loading
    let finalVendorId = vendorId; // Manual override takes precedence
    let detectedVendorId: string | null = null;
    let template = null;

    // If no manual vendor specified, try auto-detection
    if (!finalVendorId) {
      try {
        const detection = await detectVendorFromText(pdfText, userId);
        detectedVendorId = detection.vendorId;
        finalVendorId = detection.vendorId || undefined;

        console.log(`Vendor detection: ${detection.matchReason}, confidence: ${detection.confidence}, vendor: ${detection.detectedName || 'none'}`);
      } catch (detectionError) {
        console.error('Vendor detection failed:', detectionError);
        // Continue without vendor - not a fatal error
      }
    }

    // Load active template for vendor
    if (finalVendorId) {
      try {
        template = await prisma.vendorTemplate.findFirst({
          where: {
            vendorId: finalVendorId,
            isActive: true,
          },
        });
      } catch (templateError) {
        console.error('Failed to load vendor template:', templateError);
        // Continue without template - not a fatal error
      }
    }

    // Extract invoice data using AI with template
    let extractedData;
    try {
      extractedData = await extractInvoiceData(pdfText, template, userId);
    } catch (aiError) {
      throw new Error(`AI extraction failed: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`);
    }

    // Apply field mappings if template has them
    const mappedData = applyFieldMappings(extractedData, template?.fieldMappings);

    // Apply validation rules if template has them
    const validation = applyValidationRules(mappedData, template?.validationRules);

    // Determine final status based on validation
    let finalStatus = 'processed';
    if (!validation.valid) {
      finalStatus = 'validation_failed';
    }

    // Separate standard fields from custom fields
    const { standardFields, customFields } = separateStandardAndCustomFields(mappedData);

    // Parse date if present
    let parsedDate: Date | null = null;
    if (standardFields.date) {
      try {
        parsedDate = new Date(standardFields.date);
      } catch (e) {
        console.error("Error parsing date:", e);
      }
    }

    // Update invoice with extracted data
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceNumber: standardFields.invoiceNumber || null,
        date: parsedDate,
        totalAmount: standardFields.totalAmount || null,
        currency: standardFields.currency || "USD",
        status: finalStatus,
        rawText: pdfText,
        aiResponse: JSON.stringify({
          ...extractedData,
          validation: validation.valid ? null : validation.errors,
        }),
        vendorId: finalVendorId || null,
        detectedVendorId: detectedVendorId,
        templateId: template?.id || null,
        customData: Object.keys(customFields).length > 0
          ? JSON.stringify(customFields)
          : null,
        // Scanned document detection results
        isScanned: isScanned,
        textDensity: textDensity,
        lineItems: {
          create: (standardFields.lineItems || []).map((item: any, index: number) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            order: index,
          })),
        },
      },
      include: {
        lineItems: true,
        vendor: true,
      },
    });

    // Update template usage stats if template was used
    if (template) {
      await prisma.vendorTemplate.update({
        where: { id: template.id },
        data: {
          invoiceCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      }).catch(err => {
        console.error('Failed to update template stats:', err);
        // Non-fatal error, continue
      });
    }

    return {
      success: true,
      invoice: updatedInvoice,
      extractedData: mappedData,
      validation,
      vendorDetection: detectedVendorId ? {
        detectedVendorId,
        templateUsed: template?.name || null,
      } : null,
    };
  } catch (processingError) {
    // Store detailed error message
    const errorMessage = processingError instanceof Error
      ? processingError.message
      : "Unknown processing error";

    // Update status to failed with error details
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "failed",
        aiResponse: JSON.stringify({
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    throw processingError;
  }
}

/**
 * Process invoice using Vision API
 * Used for scanned documents when text extraction is insufficient
 */
async function processInvoiceSyncWithVision(
  invoiceId: string,
  userId: string,
  images: string[],
  vendorId?: string
) {
  try {
    // Load vendor template if specified
    let template = null;
    if (vendorId) {
      try {
        const vendor = await prisma.vendor.findUnique({
          where: { id: vendorId },
          include: {
            templates: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (vendor?.templates?.[0]) {
          template = vendor.templates[0];
          console.log(`Using template: ${template.name} for vendor: ${vendor.name}`);
        }
      } catch (templateError) {
        console.error('Failed to load vendor template:', templateError);
        // Continue without template - not a fatal error
      }
    }

    // Extract data using Vision API
    console.log(`Calling Vision API for invoice ${invoiceId} with ${images.length} images`);
    const { data: extractedData, cost } = await extractInvoiceDataWithVision(
      images,
      template,
      userId,
      { pageCount: images.length }
    );

    console.log(`Vision extraction completed. Cost: $${cost.toFixed(4)}`);

    // Apply field mappings if template has them
    const mappedData = applyFieldMappings(extractedData, template?.fieldMappings);

    // Apply validation rules if template has them
    const validation = applyValidationRules(mappedData, template?.validationRules);

    // Determine final status based on validation
    const finalStatus = validation.valid ? 'processed' : 'validation_failed';

    // Separate standard fields from custom fields
    const { standardFields, customFields } = separateStandardAndCustomFields(mappedData);

    // Parse date if present
    let parsedDate: Date | null = null;
    if (standardFields.date) {
      try {
        parsedDate = new Date(standardFields.date);
      } catch (e) {
        console.error("Error parsing date:", e);
      }
    }

    // Update invoice with Vision results
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceNumber: standardFields.invoiceNumber || null,
        date: parsedDate,
        totalAmount: standardFields.totalAmount || null,
        currency: standardFields.currency || "USD",
        status: finalStatus,
        rawText: 'Processed with Vision API',
        aiResponse: JSON.stringify({
          ...extractedData,
          validation: validation.valid ? null : validation.errors,
          processedWithVision: true,
          visionApiCost: cost,
        }),
        vendorId: vendorId || null,
        templateId: template?.id || null,
        customData: Object.keys(customFields).length > 0
          ? JSON.stringify(customFields)
          : null,
        // Vision processing metadata
        processedWithVision: true,
        visionApiCost: cost,
        isScanned: true, // Vision processing implies scanned document
        textDensity: 0, // No text extraction performed
        lineItems: {
          create: (standardFields.lineItems || []).map((item: any, index: number) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            order: index,
          })),
        },
      },
      include: {
        lineItems: true,
        vendor: true,
      },
    });

    // Update template usage stats if template was used
    if (template) {
      await prisma.vendorTemplate.update({
        where: { id: template.id },
        data: {
          invoiceCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      }).catch(err => {
        console.error('Failed to update template stats:', err);
        // Non-fatal error, continue
      });
    }

    console.log(`Invoice ${invoiceId} processed successfully with Vision API`);

    return {
      success: true,
      invoice: updatedInvoice,
      extractedData: mappedData,
      validation,
      visionCost: cost,
    };
  } catch (visionError) {
    // Store detailed error message
    const errorMessage = visionError instanceof Error
      ? visionError.message
      : "Unknown Vision processing error";

    console.error(`Vision processing failed for invoice ${invoiceId}:`, errorMessage);

    // Update status to failed with error details
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "failed",
        aiResponse: JSON.stringify({
          error: errorMessage,
          timestamp: new Date().toISOString(),
          processedWithVision: true,
        }),
      },
    });

    throw visionError;
  }
}
