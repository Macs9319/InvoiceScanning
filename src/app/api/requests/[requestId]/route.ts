import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { UpdateRequestSchema } from '@/types/request';
import { logAuditEvent, AuditEventTypes, AuditEventCategories } from '@/lib/audit/logger';
import { extractRequestMetadata } from '@/lib/audit/middleware';
import { calculateRequestStatus } from '@/lib/requests/status-calculator';
import { updateRequestStatistics } from '@/lib/requests/statistics';

/**
 * GET /api/requests/[requestId]
 * Get detailed information about a specific request
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

    // 2. Fetch request with related data
    const uploadRequest = await prisma.uploadRequest.findUnique({
      where: { id: requestId },
      include: {
        defaultVendor: {
          select: {
            id: true,
            name: true,
          },
        },
        invoices: {
          select: {
            id: true,
            fileName: true,
            status: true,
            totalAmount: true,
            currency: true,
            date: true,
            invoiceNumber: true,
            createdAt: true,
            updatedAt: true,
            vendor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            invoices: true,
            auditLogs: true,
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

    return NextResponse.json({ request: uploadRequest });
  } catch (error: any) {
    console.error('Error fetching request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch request' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/requests/[requestId]
 * Update request metadata (title, description, vendor, autoProcess)
 */
export async function PATCH(
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

    // 2. Fetch existing request
    const existingRequest = await prisma.uploadRequest.findUnique({
      where: { id: requestId },
    });

    // 3. Check if request exists
    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // 4. Verify ownership
    if (existingRequest.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 5. Parse and validate request body
    const body = await request.json();
    const validatedData = UpdateRequestSchema.parse(body);

    // 6. Update request in database
    const updatedRequest = await prisma.uploadRequest.update({
      where: { id: requestId },
      data: {
        title: validatedData.title,
        description: validatedData.description,
        defaultVendorId: validatedData.defaultVendorId,
        autoProcess: validatedData.autoProcess,
        updatedAt: new Date(),
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

    // 7. Log audit event
    const { ipAddress, userAgent } = extractRequestMetadata(request);
    await logAuditEvent({
      requestId: updatedRequest.id,
      userId: session.user.id,
      eventType: AuditEventTypes.REQUEST_UPDATED,
      eventCategory: AuditEventCategories.REQUEST_LIFECYCLE,
      severity: 'info',
      summary: `Request updated: ${updatedRequest.title}`,
      details: validatedData,
      targetType: 'request',
      targetId: updatedRequest.id,
      previousValue: existingRequest,
      newValue: updatedRequest,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      request: updatedRequest,
      message: 'Request updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating request:', error);

    // Zod validation error
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/requests/[requestId]
 * Delete a request (invoices are unlinked, not deleted)
 */
export async function DELETE(
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

    // 2. Fetch existing request
    const existingRequest = await prisma.uploadRequest.findUnique({
      where: { id: requestId },
      include: {
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    // 3. Check if request exists
    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // 4. Verify ownership
    if (existingRequest.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 5. Prevent deletion if request is processing
    if (existingRequest.status === 'processing') {
      return NextResponse.json(
        { error: 'Cannot delete request while processing' },
        { status: 400 }
      );
    }

    // 6. Delete request (invoices will be unlinked via onDelete: SetNull)
    await prisma.uploadRequest.delete({
      where: { id: requestId },
    });

    // 7. Log audit event
    const { ipAddress, userAgent } = extractRequestMetadata(request);
    await logAuditEvent({
      userId: session.user.id,
      eventType: AuditEventTypes.REQUEST_DELETED,
      eventCategory: AuditEventCategories.REQUEST_LIFECYCLE,
      severity: 'warning',
      summary: `Request deleted: ${existingRequest.title}`,
      details: {
        invoiceCount: existingRequest._count.invoices,
      },
      targetType: 'request',
      targetId: requestId,
      previousValue: existingRequest,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      message: 'Request deleted successfully',
      invoicesUnlinked: existingRequest._count.invoices,
    });
  } catch (error: any) {
    console.error('Error deleting request:', error);
    return NextResponse.json(
      { error: 'Failed to delete request' },
      { status: 500 }
    );
  }
}
