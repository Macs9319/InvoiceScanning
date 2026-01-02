import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { addInvoiceJob } from '@/lib/queue/invoice-queue';
import { logAuditEvent, logBulkAuditEvents, AuditEventTypes, AuditEventCategories } from '@/lib/audit/logger';
import { extractRequestMetadata } from '@/lib/audit/middleware';
import { canRetryRequest } from '@/lib/requests/status-calculator';
import { updateRequestStatistics } from '@/lib/requests/statistics';

const WORKER_MODE = process.env.WORKER_MODE || 'separate';

/**
 * POST /api/requests/[requestId]/retry
 * Retry processing failed invoices in a request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { requestId } = params;

    // 2. Fetch request with failed invoices
    const uploadRequest = await prisma.uploadRequest.findUnique({
      where: { id: requestId },
      include: {
        invoices: {
          where: {
            OR: [
              { status: 'failed' },
              { status: 'validation_failed' },
            ],
          },
        },
      },
    });

    // 3. Check if request exists
    if (!uploadRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // 4. Verify ownership
    if (uploadRequest.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 5. Check if request can be retried
    if (!canRetryRequest(uploadRequest.status, uploadRequest.failedCount)) {
      return NextResponse.json(
        { error: 'Request has no failed invoices to retry' },
        { status: 400 }
      );
    }

    const failedInvoices = uploadRequest.invoices;

    if (failedInvoices.length === 0) {
      return NextResponse.json(
        { error: 'No failed invoices to retry' },
        { status: 400 }
      );
    }

    // 6. Process each failed invoice
    const retriedJobs: { invoiceId: string; jobId?: string; error?: string }[] = [];
    const useSync = WORKER_MODE === 'disabled';

    for (const invoice of failedInvoices) {
      try {
        // Delete old line items
        await prisma.lineItem.deleteMany({
          where: { invoiceId: invoice.id },
        });

        if (useSync) {
          // Synchronous mode: Set to pending for immediate processing
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'processing',
              aiResponse: null,
              lastError: null,
              retryCount: { increment: 1 },
              processingStartedAt: new Date(),
            },
          });

          retriedJobs.push({ invoiceId: invoice.id });
        } else {
          // Async mode: Queue the retry job
          const jobId = await addInvoiceJob({
            invoiceId: invoice.id,
            userId: session.user.id,
            vendorId: uploadRequest.defaultVendorId || invoice.vendorId || undefined,
            attempt: invoice.retryCount + 1,
          });

          // Reset invoice status and increment retry count
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'queued',
              jobId,
              aiResponse: null,
              lastError: null,
              retryCount: { increment: 1 },
            },
          });

          retriedJobs.push({ invoiceId: invoice.id, jobId });
        }
      } catch (error: any) {
        console.error(`Error retrying invoice ${invoice.id}:`, error);
        retriedJobs.push({
          invoiceId: invoice.id,
          error: error.message || 'Failed to queue retry',
        });
      }
    }

    // 7. Update request status back to processing
    await prisma.uploadRequest.update({
      where: { id: requestId },
      data: {
        status: 'processing',
        updatedAt: new Date(),
      },
    });

    // 8. Update statistics
    await updateRequestStatistics(prisma, requestId);

    // 9. Log audit events
    const { ipAddress, userAgent } = extractRequestMetadata(request);

    // Log bulk retry event
    await logAuditEvent({
      requestId,
      userId: session.user.id,
      eventType: AuditEventTypes.BULK_RETRY,
      eventCategory: AuditEventCategories.USER_ACTION,
      severity: 'warning',
      summary: `Retrying ${retriedJobs.length} failed invoice(s) in request`,
      details: {
        invoiceCount: retriedJobs.length,
        successCount: retriedJobs.filter(j => !j.error).length,
        errorCount: retriedJobs.filter(j => j.error).length,
      },
      targetType: 'request',
      targetId: requestId,
      ipAddress,
      userAgent,
    });

    // Log individual invoice retry events
    const auditEvents = retriedJobs
      .filter(job => !job.error)
      .map(job => ({
        requestId,
        userId: session.user.id,
        eventType: AuditEventTypes.INVOICE_RETRIED,
        eventCategory: AuditEventCategories.INVOICE_OPERATION,
        severity: 'warning' as const,
        summary: `Invoice retry queued`,
        targetType: 'invoice',
        targetId: job.invoiceId,
        metadata: { jobId: job.jobId },
        ipAddress,
        userAgent,
      }));

    await logBulkAuditEvents(auditEvents);

    return NextResponse.json({
      message: 'Retry submitted successfully',
      retriedCount: retriedJobs.filter(j => !j.error).length,
      errorCount: retriedJobs.filter(j => j.error).length,
      jobs: retriedJobs,
    });
  } catch (error: any) {
    console.error('Error retrying request:', error);
    return NextResponse.json(
      { error: 'Failed to retry request' },
      { status: 500 }
    );
  }
}
