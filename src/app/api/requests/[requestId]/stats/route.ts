import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { calculateRequestStatistics } from '@/lib/requests/statistics';

/**
 * GET /api/requests/[requestId]/stats
 * Get detailed statistics for a request
 */
export async function GET(
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

    // 2. Fetch request
    const uploadRequest = await prisma.uploadRequest.findUnique({
      where: { id: requestId },
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

    // 5. Fetch invoices with relevant fields for statistics
    const invoices = await prisma.invoice.findMany({
      where: { requestId },
      select: {
        status: true,
        totalAmount: true,
        currency: true,
        processingStartedAt: true,
        processingCompletedAt: true,
      },
    });

    // 6. Calculate comprehensive statistics
    const stats = calculateRequestStatistics(invoices);

    // 7. Add request metadata
    const response = {
      ...stats,
      requestId: uploadRequest.id,
      title: uploadRequest.title,
      status: uploadRequest.status,
      createdAt: uploadRequest.createdAt,
      submittedAt: uploadRequest.submittedAt,
      completedAt: uploadRequest.completedAt,
      updatedAt: uploadRequest.updatedAt,
    };

    return NextResponse.json({ stats: response });
  } catch (error: any) {
    console.error('Error fetching request statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
