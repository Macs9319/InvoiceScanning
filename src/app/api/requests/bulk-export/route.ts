import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { BulkRequestOperationSchema } from '@/types/request';
import { logAuditEvent, AuditEventTypes, AuditEventCategories } from '@/lib/audit/logger';
import { extractRequestMetadata } from '@/lib/audit/middleware';

/**
 * POST /api/requests/bulk-export
 * Export multiple requests to JSON or CSV
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

    // 2. Get format from query params
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Use json or csv' },
        { status: 400 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validatedData = BulkRequestOperationSchema.parse(body);

    // 4. Fetch all requests with statistics
    const requests = await prisma.uploadRequest.findMany({
      where: {
        id: { in: validatedData.requestIds },
        userId: session.user.id,
      },
      include: {
        defaultVendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (requests.length === 0) {
      return NextResponse.json(
        { error: 'No requests found' },
        { status: 404 }
      );
    }

    // 5. Log audit event
    const { ipAddress, userAgent } = extractRequestMetadata(request);
    await logAuditEvent({
      userId: session.user.id,
      eventType: AuditEventTypes.BULK_EXPORT,
      eventCategory: AuditEventCategories.USER_ACTION,
      severity: 'info',
      summary: `Exported ${requests.length} request(s) to ${format.toUpperCase()}`,
      details: {
        requestIds: validatedData.requestIds,
        format,
        count: requests.length,
      },
      targetType: 'request',
      ipAddress,
      userAgent,
    });

    // 6. Generate export based on format
    if (format === 'json') {
      return NextResponse.json(requests, {
        headers: {
          'Content-Disposition': `attachment; filename="requests-export-${Date.now()}.json"`,
        },
      });
    } else {
      // CSV format
      const csvHeaders = [
        'ID',
        'Title',
        'Status',
        'Total Invoices',
        'Processed',
        'Failed',
        'Pending',
        'Total Amount',
        'Currency',
        'Vendor',
        'Created At',
        'Submitted At',
        'Completed At',
      ];

      const csvRows = requests.map(req => [
        req.id,
        req.title || '',
        req.status,
        req.totalInvoices,
        req.processedCount,
        req.failedCount,
        req.pendingCount,
        req.totalAmount || '',
        req.currency || '',
        req.defaultVendor?.name || '',
        req.createdAt.toISOString(),
        req.submittedAt?.toISOString() || '',
        req.completedAt?.toISOString() || '',
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row =>
          row.map(cell =>
            typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))
              ? `"${cell.replace(/"/g, '""')}"`
              : cell
          ).join(',')
        ),
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="requests-export-${Date.now()}.csv"`,
        },
      });
    }
  } catch (error: any) {
    console.error('Error bulk exporting requests:', error);

    // Zod validation error
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to export requests' },
      { status: 500 }
    );
  }
}
