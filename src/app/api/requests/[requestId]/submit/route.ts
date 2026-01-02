import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { addInvoiceJob } from '@/lib/queue/invoice-queue';
import { logAuditEvent, logBulkAuditEvents, AuditEventTypes, AuditEventCategories } from '@/lib/audit/logger';
import { extractRequestMetadata } from '@/lib/audit/middleware';
import { canSubmitRequest } from '@/lib/requests/status-calculator';
import { updateRequestStatistics } from '@/lib/requests/statistics';
import { processInvoiceSync } from '@/app/api/process/legacy-processor';

const WORKER_MODE = process.env.WORKER_MODE || 'separate';

/**
 * POST /api/requests/[requestId]/submit
 * Submit a request for AI processing
 * Queues all pending invoices in the request
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

    // 2. Fetch request with invoices
    const uploadRequest = await prisma.uploadRequest.findUnique({
      where: { id: requestId },
      include: {
        invoices: {
          where: { status: 'pending' },
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

    // 5. Check if request can be submitted
    if (!canSubmitRequest(uploadRequest.status, uploadRequest.pendingCount)) {
      return NextResponse.json(
        { error: 'Request cannot be submitted (must be in draft status with pending invoices)' },
        { status: 400 }
      );
    }

    const pendingInvoices = uploadRequest.invoices;

    if (pendingInvoices.length === 0) {
      return NextResponse.json(
        { error: 'No pending invoices to process' },
        { status: 400 }
      );
    }

    // 6. Queue all pending invoices
    const queuedJobs: { invoiceId: string; jobId?: string; error?: string }[] = [];
    const useSync = WORKER_MODE === 'disabled';

    for (const invoice of pendingInvoices) {
      try {
        if (useSync) {
          // Synchronous processing fallback
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'processing',
              processingStartedAt: new Date(),
            },
          });

          // Process will happen asynchronously via worker or sync
          queuedJobs.push({ invoiceId: invoice.id });
        } else {
          // Async mode: Queue the job
          const jobId = await addInvoiceJob({
            invoiceId: invoice.id,
            userId: session.user.id,
            vendorId: uploadRequest.defaultVendorId || undefined,
            attempt: 0,
          });

          // Update invoice with job ID and status
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'queued',
              jobId,
            },
          });

          queuedJobs.push({ invoiceId: invoice.id, jobId });
        }
      } catch (error: any) {
        console.error(`Error queueing invoice ${invoice.id}:`, error);
        queuedJobs.push({
          invoiceId: invoice.id,
          error: error.message || 'Failed to queue',
        });
      }
    }

    // 7. Update request status and timestamp
    await prisma.uploadRequest.update({
      where: { id: requestId },
      data: {
        status: 'processing',
        submittedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 8. Update statistics
    await updateRequestStatistics(prisma, requestId);

    // 9. Log audit events
    const { ipAddress, userAgent } = extractRequestMetadata(request);

    // Log request submission
    await logAuditEvent({
      requestId,
      userId: session.user.id,
      eventType: AuditEventTypes.REQUEST_SUBMITTED,
      eventCategory: AuditEventCategories.REQUEST_LIFECYCLE,
      severity: 'info',
      summary: `Request submitted for processing: ${uploadRequest.title}`,
      details: {
        invoiceCount: queuedJobs.length,
        successCount: queuedJobs.filter(j => !j.error).length,
        errorCount: queuedJobs.filter(j => j.error).length,
      },
      targetType: 'request',
      targetId: requestId,
      ipAddress,
      userAgent,
    });

    // Log individual invoice queue events
    const auditEvents = queuedJobs
      .filter(job => !job.error)
      .map(job => ({
        requestId,
        userId: session.user.id,
        eventType: AuditEventTypes.INVOICE_PROCESSING_STARTED,
        eventCategory: AuditEventCategories.INVOICE_OPERATION,
        severity: 'info' as const,
        summary: `Invoice queued for processing`,
        targetType: 'invoice',
        targetId: job.invoiceId,
        metadata: { jobId: job.jobId },
        ipAddress,
        userAgent,
      }));

    await logBulkAuditEvents(auditEvents);

    return NextResponse.json({
      message: 'Request submitted successfully',
      queuedCount: queuedJobs.filter(j => !j.error).length,
      errorCount: queuedJobs.filter(j => j.error).length,
      jobs: queuedJobs,
    });
  } catch (error: any) {
    console.error('Error submitting request:', error);
    return NextResponse.json(
      { error: 'Failed to submit request' },
      { status: 500 }
    );
  }
}
