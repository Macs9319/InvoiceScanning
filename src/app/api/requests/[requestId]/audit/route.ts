import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { AuditLogQuerySchema, parseAuditLogJson } from '@/types/audit';

/**
 * GET /api/requests/[requestId]/audit
 * Get audit logs for a specific request with filtering and pagination
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

    // 3. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      eventType: searchParams.get('eventType') || undefined,
      eventCategory: searchParams.get('eventCategory') || undefined,
      severity: searchParams.get('severity') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    const validatedQuery = AuditLogQuerySchema.parse(queryParams);

    // 4. Build where clause
    const where: any = {
      requestId,
      userId: session.user.id,
    };

    if (validatedQuery.eventType) {
      where.eventType = validatedQuery.eventType;
    }

    if (validatedQuery.eventCategory) {
      where.eventCategory = validatedQuery.eventCategory;
    }

    if (validatedQuery.severity) {
      where.severity = validatedQuery.severity;
    }

    // 5. Calculate pagination
    const skip = (validatedQuery.page - 1) * validatedQuery.limit;
    const take = validatedQuery.limit;

    // 6. Build orderBy clause
    const orderBy: any = {
      [validatedQuery.sortBy]: validatedQuery.sortOrder,
    };

    // 7. Fetch audit logs and total count
    const [auditLogs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // 8. Parse JSON fields in audit logs
    const parsedLogs = auditLogs.map(log => parseAuditLogJson(log as any));

    // 9. Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedQuery.limit);
    const hasNextPage = validatedQuery.page < totalPages;
    const hasPrevPage = validatedQuery.page > 1;

    return NextResponse.json({
      logs: parsedLogs,
      pagination: {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);

    // Zod validation error
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
