/**
 * Invoice Status Polling API
 * Allows frontend to poll for job status updates
 * GET /api/invoices/status?ids=id1,id2,id3
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getJobStatus } from '@/lib/queue/invoice-queue';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids'); // Comma-separated invoice IDs

    if (!idsParam) {
      return NextResponse.json({ error: 'Invoice IDs required' }, { status: 400 });
    }

    const invoiceIds = idsParam.split(',').filter(Boolean);

    if (invoiceIds.length === 0) {
      return NextResponse.json({ error: 'No valid invoice IDs provided' }, { status: 400 });
    }

    // Fetch invoices with ownership check
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        userId: session.user.id, // Ensure user can only see their own invoices
      },
      select: {
        id: true,
        status: true,
        jobId: true,
        processingStartedAt: true,
        processingCompletedAt: true,
        retryCount: true,
        lastError: true,
        updatedAt: true,
      },
    });

    // Enrich with job queue status if available
    const statusMap = await Promise.all(
      invoices.map(async (invoice) => {
        let jobStatus = null;
        let estimatedTime = null;

        if (invoice.jobId) {
          try {
            const queueStatus = await getJobStatus(invoice.jobId);
            jobStatus = queueStatus.status;
          } catch (err) {
            console.error(`Failed to get job status for ${invoice.jobId}:`, err);
          }
        }

        // Calculate elapsed time for processing jobs
        if (invoice.processingStartedAt) {
          const elapsed = Date.now() - invoice.processingStartedAt.getTime();
          estimatedTime = {
            elapsed: Math.floor(elapsed / 1000), // seconds
            estimated: 30, // seconds (based on typical job duration)
          };
        }

        return {
          invoiceId: invoice.id,
          status: invoice.status,
          jobStatus,
          processingStartedAt: invoice.processingStartedAt,
          processingCompletedAt: invoice.processingCompletedAt,
          retryCount: invoice.retryCount,
          lastError: invoice.lastError,
          estimatedTime,
          updatedAt: invoice.updatedAt,
        };
      })
    );

    return NextResponse.json({
      success: true,
      statuses: statusMap,
    });
  } catch (error) {
    console.error('Error fetching invoice statuses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice statuses' },
      { status: 500 }
    );
  }
}
