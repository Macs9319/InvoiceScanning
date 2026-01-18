/**
 * Core Invoice Processing Logic
 * Extracted from /api/process route for reuse by worker and fallback modes
 */
import { Job } from 'bullmq';
import { prisma } from '@/lib/db/prisma';
import { parsePDF } from '@/lib/pdf/parser';
import { detectScannedDocument } from '@/lib/pdf/detector';
import { extractInvoiceData, extractInvoiceDataWithVision, extractInvoiceDataWithFallback } from '@/lib/ai/extractor';
import { detectVendorFromText } from '@/lib/ai/vendor-detector';
import { applyFieldMappings, separateStandardAndCustomFields } from '@/lib/ai/field-mapper';
import { applyValidationRules } from '@/lib/ai/schema-builder';
import { getStorageForFile } from '@/lib/storage';
import { InvoiceJobData, InvoiceJobResult } from '@/lib/queue/invoice-queue';
import { updateRequestStatistics } from '@/lib/requests/statistics';
import { calculateRequestStatus } from '@/lib/requests/status-calculator';
import { logAuditEvent, AuditEventTypes, AuditEventCategories } from '@/lib/audit/logger';

export async function processInvoiceJob(
  job: Job<InvoiceJobData>
): Promise<InvoiceJobResult> {
  const { invoiceId, userId, vendorId, useVision, images } = job.data;

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

    // 1a. Check if Vision processing is requested
    if (useVision && images && images.length > 0) {
      console.log(`Processing invoice ${invoiceId} with Vision API (${images.length} images)`);
      return await processInvoiceJobWithVision(job, invoice);
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

    // 2a. Update request statistics when processing starts
    if (invoice.requestId) {
      try {
        await updateRequestStatistics(prisma, invoice.requestId);

        // Log audit event for invoice processing start
        await logAuditEvent({
          requestId: invoice.requestId,
          userId: invoice.userId,
          eventType: AuditEventTypes.INVOICE_PROCESSING_STARTED,
          eventCategory: AuditEventCategories.INVOICE_OPERATION,
          severity: 'info',
          summary: `Invoice processing started: ${invoice.fileName}`,
          details: {
            attempt: job.attemptsMade,
            jobId: job.id,
          },
          targetType: 'invoice',
          targetId: invoiceId,
          previousValue: { status: invoice.status },
          newValue: { status: 'processing' },
        });
      } catch (requestUpdateError) {
        console.error('Failed to update request at processing start:', requestUpdateError);
        // Non-fatal error, continue processing
      }
    }

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

    // 4. Extract text from PDF and detect if scanned
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

      // If PDF has no extractable text, set empty string and continue
      // Gemini's native PDF processing will handle scanned documents automatically
      if (!pdfText || pdfText.trim().length === 0) {
        console.log(`Invoice ${invoiceId}: No extractable text found, will use native PDF processing`);
        pdfText = ''; // Set empty string so AI extraction can proceed with native PDF
        isScanned = true; // Mark as scanned to trigger native PDF processing
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
        finalVendorId = detection.vendorId || undefined;

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
    // Use fallback which automatically handles scanned documents with native PDF processing
    let extractedData;
    let visionApiCost = 0;
    let processedWithVision = false;
    try {
      const result = await extractInvoiceDataWithFallback(
        pdfText,
        fileBuffer, // Pass PDF buffer for native PDF processing
        template,
        userId,
        isScanned // Flag to indicate if document is scanned
      );
      extractedData = result.data;
      visionApiCost = result.cost;
      processedWithVision = result.usedNativePDF;

      if (processedWithVision) {
        console.log(`Invoice ${invoiceId}: Processed with native PDF extraction (cost: $${visionApiCost.toFixed(6)})`);
      }
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
        processedWithVision: processedWithVision,
        visionApiCost: visionApiCost > 0 ? visionApiCost : null,
        isScanned: isScanned,
        textDensity: textDensity,
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

    // 13. Update request statistics and status if invoice belongs to a request
    if (invoice.requestId) {
      try {
        // Update request statistics
        await updateRequestStatistics(prisma, invoice.requestId);

        // Log audit event for invoice processing completion
        await logAuditEvent({
          requestId: invoice.requestId,
          userId: invoice.userId,
          eventType: AuditEventTypes.INVOICE_PROCESSING_COMPLETED,
          eventCategory: AuditEventCategories.INVOICE_OPERATION,
          severity: finalStatus === 'validation_failed' ? 'warning' : 'info',
          summary: `Invoice processed: ${invoice.fileName}`,
          details: {
            invoiceNumber: standardFields.invoiceNumber,
            totalAmount: standardFields.totalAmount,
            currency: standardFields.currency,
            validationStatus: finalStatus,
            vendorDetected: detectedVendorId !== null,
            templateUsed: template !== null,
          },
          targetType: 'invoice',
          targetId: invoiceId,
          newValue: {
            status: finalStatus,
            totalAmount: standardFields.totalAmount,
            currency: standardFields.currency,
          },
        });

        // Check if request status needs to be updated
        const request = await prisma.uploadRequest.findUnique({
          where: { id: invoice.requestId },
          include: {
            invoices: {
              select: {
                status: true,
              },
            },
          },
        });

        if (request) {
          const newStatus = calculateRequestStatus(request.invoices);

          // Only update if status changed
          if (newStatus !== request.status) {
            const updateData: any = {
              status: newStatus,
              updatedAt: new Date(),
            };

            // Set completedAt if request is now in a terminal state
            if (['completed', 'partial', 'failed'].includes(newStatus)) {
              updateData.completedAt = new Date();
            }

            await prisma.uploadRequest.update({
              where: { id: invoice.requestId },
              data: updateData,
            });

            // Log request status change
            await logAuditEvent({
              requestId: invoice.requestId,
              userId: invoice.userId,
              eventType: AuditEventTypes.REQUEST_UPDATED,
              eventCategory: AuditEventCategories.REQUEST_LIFECYCLE,
              severity: 'info',
              summary: `Request status changed: ${request.status} → ${newStatus}`,
              details: {
                trigger: 'invoice_processing_completed',
                invoiceId,
              },
              targetType: 'request',
              targetId: invoice.requestId,
              previousValue: { status: request.status },
              newValue: { status: newStatus },
            });
          }
        }
      } catch (requestUpdateError) {
        console.error('Failed to update request statistics:', requestUpdateError);
        // Non-fatal error, don't fail the job
      }
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

    // Get invoice to check for requestId
    const failedInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { requestId: true, userId: true, fileName: true },
    });

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

    // Update request statistics if invoice belongs to a request
    if (failedInvoice?.requestId) {
      try {
        // Update request statistics
        await updateRequestStatistics(prisma, failedInvoice.requestId);

        // Log audit event for invoice processing failure
        await logAuditEvent({
          requestId: failedInvoice.requestId,
          userId: failedInvoice.userId,
          eventType: AuditEventTypes.INVOICE_PROCESSING_FAILED,
          eventCategory: AuditEventCategories.INVOICE_OPERATION,
          severity: 'error',
          summary: `Invoice processing failed: ${failedInvoice.fileName}`,
          details: {
            errorMessage,
            attempt: job.attemptsMade,
          },
          targetType: 'invoice',
          targetId: invoiceId,
          newValue: {
            status: 'failed',
            error: errorMessage,
          },
        });

        // Check if request status needs to be updated
        const request = await prisma.uploadRequest.findUnique({
          where: { id: failedInvoice.requestId },
          include: {
            invoices: {
              select: {
                status: true,
              },
            },
          },
        });

        if (request) {
          const newStatus = calculateRequestStatus(request.invoices);

          // Only update if status changed
          if (newStatus !== request.status) {
            const updateData: any = {
              status: newStatus,
              updatedAt: new Date(),
            };

            // Set completedAt if request is now in a terminal state
            if (['completed', 'partial', 'failed'].includes(newStatus)) {
              updateData.completedAt = new Date();
            }

            await prisma.uploadRequest.update({
              where: { id: failedInvoice.requestId },
              data: updateData,
            });

            // Log request status change
            await logAuditEvent({
              requestId: failedInvoice.requestId,
              userId: failedInvoice.userId,
              eventType: AuditEventTypes.REQUEST_UPDATED,
              eventCategory: AuditEventCategories.REQUEST_LIFECYCLE,
              severity: 'warning',
              summary: `Request status changed: ${request.status} → ${newStatus}`,
              details: {
                trigger: 'invoice_processing_failed',
                invoiceId,
                errorMessage,
              },
              targetType: 'request',
              targetId: failedInvoice.requestId,
              previousValue: { status: request.status },
              newValue: { status: newStatus },
            });
          }
        }
      } catch (requestUpdateError) {
        console.error('Failed to update request after processing failure:', requestUpdateError);
        // Non-fatal error, don't prevent the retry
      }
    }

    throw processingError; // Re-throw for BullMQ retry logic
  }
}

/**
 * Process invoice using Vision API
 * Used for scanned documents or when text extraction failed
 */
async function processInvoiceJobWithVision(
  job: Job<InvoiceJobData>,
  invoice: any
): Promise<InvoiceJobResult> {
  const { invoiceId, userId, vendorId, images } = job.data;

  if (!images || images.length === 0) {
    throw new Error('No images provided for Vision processing');
  }

  try {
    // Update status to processing
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'processing',
        processingStartedAt: new Date(),
        jobId: job.id,
      },
    });

    // Get vendor template if specified
    let finalVendorId = vendorId;
    let template = null;

    if (finalVendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: finalVendorId },
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
      }
    }

    // Extract with Vision API
    console.log(`Calling Vision API for invoice ${invoiceId} with ${images.length} images...`);
    const { data: extractedData, cost } = await extractInvoiceDataWithVision(
      images,
      template,
      userId,
      { pageCount: images.length }
    );

    console.log(`Vision extraction completed. Cost: $${cost.toFixed(4)}`);

    // Apply field mappings
    const mappedData = applyFieldMappings(extractedData, template?.fieldMappings);

    // Apply validation
    const validation = applyValidationRules(mappedData, template?.validationRules);
    const finalStatus = validation.valid ? 'processed' : 'validation_failed';

    // Separate standard and custom fields
    const { standardFields, customFields } = separateStandardAndCustomFields(mappedData);

    // Parse date
    let parsedDate: Date | null = null;
    if (standardFields.date) {
      try {
        parsedDate = new Date(standardFields.date);
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    }

    // Update invoice with Vision results
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceNumber: standardFields.invoiceNumber || null,
        date: parsedDate,
        totalAmount: standardFields.totalAmount || null,
        currency: standardFields.currency || 'USD',
        status: finalStatus,
        rawText: 'Processed with Vision API',
        aiResponse: JSON.stringify({
          ...extractedData,
          validation: validation.valid ? null : validation.errors,
          processedWithVision: true,
          visionCost: cost,
        }),
        vendorId: finalVendorId || null,
        templateId: template?.id || null,
        customData: Object.keys(customFields).length > 0 ? JSON.stringify(customFields) : null,
        processedWithVision: true,
        visionApiCost: cost,
        processingCompletedAt: new Date(),
        lastError: null,
        lineItems: {
          deleteMany: {}, // Clear old line items
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

    // Log audit event
    if (invoice.requestId) {
      await logAuditEvent({
        requestId: invoice.requestId,
        userId,
        eventType: AuditEventTypes.INVOICE_PROCESSING_COMPLETED,
        eventCategory: AuditEventCategories.INVOICE_OPERATION,
        severity: 'info',
        summary: `Invoice processed with Vision API: ${invoice.fileName}`,
        details: {
          invoiceId,
          visionCost: cost,
          pageCount: images.length,
          status: finalStatus,
        },
        targetType: 'invoice',
        targetId: invoiceId,
        newValue: {
          status: finalStatus,
          totalAmount: standardFields.totalAmount,
          processedWithVision: true,
        },
      });
    }

    // Update request statistics if applicable
    if (invoice.requestId) {
      const request = await prisma.uploadRequest.findUnique({
        where: { id: invoice.requestId },
        include: { invoices: { select: { status: true } } },
      });

      if (request) {
        const newRequestStatus = calculateRequestStatus(request.invoices);
        await updateRequestStatistics(invoice.requestId, newRequestStatus);
      }
    }

    console.log(`Vision processing completed successfully for invoice ${invoiceId}`);

    return {
      success: true,
      invoiceId,
      extractedData: updatedInvoice,
    };
  } catch (error) {
    console.error(`Vision processing failed for invoice ${invoiceId}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown Vision processing error';

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'failed',
        lastError: errorMessage,
        aiResponse: JSON.stringify({
          error: errorMessage,
          timestamp: new Date().toISOString(),
          attemptedWithVision: true,
        }),
        processingCompletedAt: new Date(),
      },
    });

    throw error;
  }
}
