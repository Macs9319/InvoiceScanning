import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { formatForTimeline } from '@/types/audit';

/**
 * GET /api/requests/[requestId]/timeline
 * Get timeline view of events for a request
 * Returns a simplified, chronological view of all events
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

    // 2. Verify request exists and belongs to user
    const uploadRequest = await prisma.uploadRequest.findUnique({
      where: { id: requestId },
    });

    if (!uploadRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    if (uploadRequest.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 3. Parse optional limit parameter
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '100'),
      500 // Max limit to prevent performance issues
    );

    // 4. Fetch audit logs for timeline
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        requestId,
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 5. Format for timeline display
    const timelineEvents = auditLogs.map(log => formatForTimeline(log as any));

    // 6. Group events by date for easier rendering
    const groupedByDate: Record<string, typeof timelineEvents> = {};

    timelineEvents.forEach(event => {
      const dateKey = event.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(event);
    });

    return NextResponse.json({
      events: timelineEvents,
      groupedByDate,
      totalCount: auditLogs.length,
      requestTitle: uploadRequest.title,
      requestStatus: uploadRequest.status,
    });
  } catch (error: any) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
}
