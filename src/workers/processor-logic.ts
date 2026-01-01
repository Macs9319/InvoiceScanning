/**
 * Core Invoice Processing Logic
 * Extracted from /api/process route for reuse by worker and fallback modes
 */
import { Job } from 'bullmq';
import { prisma } from '@/lib/db/prisma';
import { extractTextFromPDF } from '@/lib/pdf/parser';
import { extractInvoiceData } from '@/lib/ai/extractor';
import { detectVendorFromText } from '@/lib/ai/vendor-detector';
import { applyFieldMappings, separateStandardAndCustomFields } from '@/lib/ai/field-mapper';
import { applyValidationRules } from '@/lib/ai/schema-builder';
import { getStorageForFile } from '@/lib/storage';
import { InvoiceJobData, InvoiceJobResult } from '@/lib/queue/invoice-queue';

export async function processInvoiceJob(
  job: Job<InvoiceJobData>
): Promise<InvoiceJobResult> {
  const { invoiceId, userId, vendorId } = job.data;

  try {
    // 1. Get and validate invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.userId !== userId) {
      throw new Error('Unauthorized: Invoice does not belong to user');
    }

    if (!invoice.fileUrl) {
      throw new Error('Invoice file URL not found');
    }

    // 2. Update status to processing and record job start
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'processing',
        processingStartedAt: new Date(),
        jobId: job.id,
        retryCount: job.attemptsMade,
        aiResponse: null,
        lineItems: {
          deleteMany: {}, // Clear existing line items on retry
        },
      },
    });

    // 3. Read PDF file from storage (S3 or local - auto-detected from URL)
    const storage = getStorageForFile(invoice.fileUrl);
    let fileBuffer: Buffer;

    try {
      fileBuffer = await storage.read(invoice.fileUrl);
    } catch (fileError) {
      throw new Error(
        `Failed to read PDF file: ${fileError instanceof Error ? fileError.message : 'File not found'}`
      );
    }

    // 4. Extract text from PDF
    let pdfText: string;
    try {
      pdfText = await extractTextFromPDF(fileBuffer);
      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error('PDF contains no extractable text. The document may be an image-based scan.');
      }
    } catch (pdfError) {
      throw new Error(
        `PDF text extraction failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`
      );
    }

    // 5. Vendor detection and template loading
    let finalVendorId = vendorId; // Manual override takes precedence
    let detectedVendorId: string | null = null;
    let template = null;

    // If no manual vendor specified, try auto-detection
    if (!finalVendorId) {
      try {
        const detection = await detectVendorFromText(pdfText, userId);
        detectedVendorId = detection.vendorId;
        finalVendorId = detection.vendorId;

        console.log(
          `Vendor detection: ${detection.matchReason}, confidence: ${detection.confidence}, vendor: ${detection.detectedName || 'none'}`
        );
      } catch (detectionError) {
        console.error('Vendor detection failed:', detectionError);
        // Continue without vendor - not a fatal error
      }
    }

    // 6. Load active template for vendor
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

    // 7. Extract invoice data using AI with template
    let extractedData;
    try {
      extractedData = await extractInvoiceData(pdfText, template);
    } catch (aiError) {
      throw new Error(
        `AI extraction failed: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`
      );
    }

    // 8. Apply field mappings if template has them
    const mappedData = applyFieldMappings(extractedData, template?.fieldMappings);

    // 9. Apply validation rules if template has them
    const validation = applyValidationRules(mappedData, template?.validationRules);

    // Determine final status based on validation
    let finalStatus = 'processed';
    if (!validation.valid) {
      finalStatus = 'validation_failed';
    }

    // 10. Separate standard fields from custom fields
    const { standardFields, customFields } = separateStandardAndCustomFields(mappedData);

    // Parse date if present
    let parsedDate: Date | null = null;
    if (standardFields.date) {
      try {
        parsedDate = new Date(standardFields.date);
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    }

    // 11. Update invoice with extracted data
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceNumber: standardFields.invoiceNumber || null,
        date: parsedDate,
        totalAmount: standardFields.totalAmount || null,
        currency: standardFields.currency || 'USD',
        status: finalStatus,
        rawText: pdfText,
        aiResponse: JSON.stringify({
          ...extractedData,
          validation: validation.valid ? null : validation.errors,
        }),
        vendorId: finalVendorId || null,
        detectedVendorId: detectedVendorId,
        templateId: template?.id || null,
        customData: Object.keys(customFields).length > 0 ? JSON.stringify(customFields) : null,
        processingCompletedAt: new Date(),
        lastError: null, // Clear previous errors on success
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

    // 12. Update template usage stats if template was used
    if (template) {
      await prisma.vendorTemplate
        .update({
          where: { id: template.id },
          data: {
            invoiceCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        })
        .catch((err) => {
          console.error('Failed to update template stats:', err);
          // Non-fatal error, continue
        });
    }

    return {
      success: true,
      invoiceId,
      extractedData: mappedData,
    };
  } catch (processingError) {
    // Store detailed error message
    const errorMessage =
      processingError instanceof Error ? processingError.message : 'Unknown processing error';

    // Update invoice with error
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'failed',
        lastError: errorMessage,
        aiResponse: JSON.stringify({
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    throw processingError; // Re-throw for BullMQ retry logic
  }
}
