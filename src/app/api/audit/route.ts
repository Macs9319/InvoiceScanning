import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { AuditLogQuerySchema, parseAuditLogJson } from '@/types/audit';

/**
 * GET /api/audit
 * Get global audit logs for the authenticated user
 * Supports filtering by request, event type, category, severity, and date range
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      requestId: searchParams.get('requestId') || undefined,
      eventType: searchParams.get('eventType') || undefined,
      eventCategory: searchParams.get('eventCategory') || undefined,
      severity: searchParams.get('severity') || undefined,
      targetType: searchParams.get('targetType') || undefined,
      targetId: searchParams.get('targetId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    const validatedQuery = AuditLogQuerySchema.parse(queryParams);

    // 3. Build where clause
    const where: any = {
      userId: session.user.id,
    };

    if (validatedQuery.requestId) {
      where.requestId = validatedQuery.requestId;
    }

    if (validatedQuery.eventType) {
      where.eventType = validatedQuery.eventType;
    }

    if (validatedQuery.eventCategory) {
      where.eventCategory = validatedQuery.eventCategory;
    }

    if (validatedQuery.severity) {
      where.severity = validatedQuery.severity;
    }

    if (validatedQuery.targetType) {
      where.targetType = validatedQuery.targetType;
    }

    if (validatedQuery.targetId) {
      where.targetId = validatedQuery.targetId;
    }

    // Date range filter
    if (validatedQuery.startDate || validatedQuery.endDate) {
      where.createdAt = {};
      if (validatedQuery.startDate) {
        where.createdAt.gte = new Date(validatedQuery.startDate);
      }
      if (validatedQuery.endDate) {
        where.createdAt.lte = new Date(validatedQuery.endDate);
      }
    }

    // 4. Calculate pagination
    const skip = (validatedQuery.page - 1) * validatedQuery.limit;
    const take = validatedQuery.limit;

    // 5. Build orderBy clause
    const orderBy: any = {
      [validatedQuery.sortBy]: validatedQuery.sortOrder,
    };

    // 6. Fetch audit logs and total count
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
          request: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // 7. Parse JSON fields in audit logs
    const parsedLogs = auditLogs.map(log => parseAuditLogJson(log as any));

    // 8. Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedQuery.limit);
    const hasNextPage = validatedQuery.page < totalPages;
    const hasPrevPage = validatedQuery.page > 1;

    // 9. Get summary statistics
    const [categoryCounts, severityCounts] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['eventCategory'],
        where: { userId: session.user.id },
        _count: true,
      }),
      prisma.auditLog.groupBy({
        by: ['severity'],
        where: { userId: session.user.id },
        _count: true,
      }),
    ]);

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
      statistics: {
        totalEvents: totalCount,
        eventsByCategory: categoryCounts.map(c => ({
          category: c.eventCategory,
          count: c._count,
        })),
        eventsBySeverity: severityCounts.map(s => ({
          severity: s.severity,
          count: s._count,
        })),
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
