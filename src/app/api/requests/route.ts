import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { CreateRequestSchema, RequestQuerySchema, generateAutoRequestTitle } from '@/types/request';
import { logAuditEvent, AuditEventTypes, AuditEventCategories } from '@/lib/audit/logger';
import { extractRequestMetadata } from '@/lib/audit/middleware';

/**
 * POST /api/requests
 * Create a new upload request
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
    const validatedData = CreateRequestSchema.parse(body);

    // 3. Generate title if not provided
    const title = validatedData.title || generateAutoRequestTitle();

    // 4. Create request in database
    const uploadRequest = await prisma.uploadRequest.create({
      data: {
        userId: session.user.id,
        title,
        description: validatedData.description,
        defaultVendorId: validatedData.defaultVendorId,
        autoProcess: validatedData.autoProcess,
        status: 'draft',
      },
      include: {
        defaultVendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 5. Log audit event
    const { ipAddress, userAgent } = extractRequestMetadata(request);
    await logAuditEvent({
      requestId: uploadRequest.id,
      userId: session.user.id,
      eventType: AuditEventTypes.REQUEST_CREATED,
      eventCategory: AuditEventCategories.REQUEST_LIFECYCLE,
      severity: 'info',
      summary: `Request created: ${title}`,
      details: {
        title,
        description: validatedData.description,
        defaultVendorId: validatedData.defaultVendorId,
        autoProcess: validatedData.autoProcess,
      },
      targetType: 'request',
      targetId: uploadRequest.id,
      newValue: uploadRequest,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      request: uploadRequest,
      message: 'Request created successfully',
    });
  } catch (error: any) {
    console.error('Error creating request:', error);

    // Zod validation error
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/requests
 * List requests with filtering, sorting, and pagination
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
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      vendorId: searchParams.get('vendorId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    const validatedQuery = RequestQuerySchema.parse(queryParams);

    // 3. Build where clause for filtering
    const where: any = {
      userId: session.user.id,
    };

    // Status filter
    if (validatedQuery.status) {
      where.status = validatedQuery.status;
    }

    // Vendor filter
    if (validatedQuery.vendorId) {
      where.defaultVendorId = validatedQuery.vendorId;
    }

    // Search filter (title or description)
    if (validatedQuery.search) {
      where.OR = [
        { title: { contains: validatedQuery.search, mode: 'insensitive' } },
        { description: { contains: validatedQuery.search, mode: 'insensitive' } },
      ];
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

    // 6. Fetch requests and total count in parallel
    const [requests, totalCount] = await Promise.all([
      prisma.uploadRequest.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          defaultVendor: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              invoices: true,
              auditLogs: true,
            },
          },
        },
      }),
      prisma.uploadRequest.count({ where }),
    ]);

    // 7. Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedQuery.limit);
    const hasNextPage = validatedQuery.page < totalPages;
    const hasPrevPage = validatedQuery.page > 1;

    return NextResponse.json({
      requests,
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
    console.error('Error fetching requests:', error);

    // Zod validation error
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
