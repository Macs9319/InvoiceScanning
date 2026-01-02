import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { BulkRequestOperationSchema } from '@/types/request';
import { logBulkAuditEvents, AuditEventTypes, AuditEventCategories } from '@/lib/audit/logger';
import { extractRequestMetadata } from '@/lib/audit/middleware';

/**
 * POST /api/requests/bulk-delete
 * Delete multiple requests at once
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const validatedData = BulkRequestOperationSchema.parse(body);

    // 3. Fetch all requests and verify ownership
    const requests = await prisma.uploadRequest.findMany({
      where: {
        id: { in: validatedData.requestIds },
        userId: session.user.id,
      },
      include: {
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    if (requests.length !== validatedData.requestIds.length) {
      return NextResponse.json(
        { error: 'Some requests not found or access denied' },
        { status: 404 }
      );
    }

    // 4. Check if any requests are processing (cannot delete)
    const processingRequests = requests.filter(r => r.status === 'processing');
    if (processingRequests.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete requests that are currently processing',
          processingRequestIds: processingRequests.map(r => r.id),
        },
        { status: 400 }
      );
    }

    // 5. Delete all requests
    await prisma.uploadRequest.deleteMany({
      where: {
        id: { in: validatedData.requestIds },
      },
    });

    // 6. Log audit events
    const { ipAddress, userAgent } = extractRequestMetadata(request);
    const auditEvents = requests.map(req => ({
      userId: session.user.id,
      eventType: AuditEventTypes.REQUEST_DELETED,
      eventCategory: AuditEventCategories.REQUEST_LIFECYCLE,
      severity: 'warning' as const,
      summary: `Request deleted: ${req.title}`,
      details: {
        invoiceCount: req._count.invoices,
      },
      targetType: 'request',
      targetId: req.id,
      previousValue: req,
      ipAddress,
      userAgent,
    }));

    await logBulkAuditEvents(auditEvents);

    return NextResponse.json({
      message: `${requests.length} request(s) deleted successfully`,
      count: requests.length,
      invoicesUnlinked: requests.reduce((sum, r) => sum + r._count.invoices, 0),
    });
  } catch (error: any) {
    console.error('Error bulk deleting requests:', error);

    // Zod validation error
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete requests' },
      { status: 500 }
    );
  }
}
