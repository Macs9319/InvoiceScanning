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
import { updateRequestStatistics } from '@/lib/requests/statistics';
import { calculateRequestStatus } from '@/lib/requests/status-calculator';
import { logAuditEvent, AuditEventTypes, AuditEventCategories } from '@/lib/audit/logger';

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
    let extractedData;
    try {
      extractedData = await extractInvoiceData(pdfText, template, userId);
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
