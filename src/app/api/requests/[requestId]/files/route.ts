import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { AddFilesToRequestSchema, RemoveFilesFromRequestSchema } from '@/types/request';
import { logAuditEvent, logBulkAuditEvents, AuditEventTypes, AuditEventCategories } from '@/lib/audit/logger';
import { extractRequestMetadata } from '@/lib/audit/middleware';
import { updateRequestStatistics } from '@/lib/requests/statistics';
import { calculateRequestStatus } from '@/lib/requests/status-calculator';

/**
 * POST /api/requests/[requestId]/files
 * Add existing invoices to a request
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

    // 2. Fetch and verify request ownership
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

    // 3. Check if request is in draft status (can only modify files in draft)
    if (uploadRequest.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only add files to draft requests' },
        { status: 400 }
      );
    }

    // 4. Parse and validate request body
    const body = await request.json();
    const validatedData = AddFilesToRequestSchema.parse(body);

    // 5. Verify all invoices exist and belong to user
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: validatedData.invoiceIds },
        userId: session.user.id,
      },
    });

    if (invoices.length !== validatedData.invoiceIds.length) {
      return NextResponse.json(
        { error: 'Some invoices not found or access denied' },
        { status: 404 }
      );
    }

    // 6. Check if any invoices are already in another request
    const invoicesInOtherRequests = invoices.filter(inv => inv.requestId && inv.requestId !== requestId);
    if (invoicesInOtherRequests.length > 0) {
      return NextResponse.json(
        {
          error: 'Some invoices are already in another request',
          invoiceIds: invoicesInOtherRequests.map(inv => inv.id),
        },
        { status: 400 }
      );
    }

    // 7. Add invoices to request
    await prisma.invoice.updateMany({
      where: {
        id: { in: validatedData.invoiceIds },
      },
      data: {
        requestId,
      },
    });

    // 8. Update request statistics
    await updateRequestStatistics(prisma, requestId);

    // 9. Log audit events for each invoice
    const { ipAddress, userAgent } = extractRequestMetadata(request);
    const auditEvents = invoices.map(invoice => ({
      requestId,
      userId: session.user.id,
      eventType: AuditEventTypes.INVOICE_ADDED_TO_REQUEST,
      eventCategory: AuditEventCategories.INVOICE_OPERATION,
      severity: 'info' as const,
      summary: `Invoice ${invoice.fileName} added to request`,
      targetType: 'invoice',
      targetId: invoice.id,
      ipAddress,
      userAgent,
    }));

    await logBulkAuditEvents(auditEvents);

    return NextResponse.json({
      message: `${invoices.length} invoice(s) added to request`,
      count: invoices.length,
    });
  } catch (error: any) {
    console.error('Error adding files to request:', error);

    // Zod validation error
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add files to request' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/requests/[requestId]/files
 * Remove invoices from a request (invoices become orphaned, not deleted)
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

    // 2. Fetch and verify request ownership
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

    // 3. Check if request is in draft status
    if (uploadRequest.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only remove files from draft requests' },
        { status: 400 }
      );
    }

    // 4. Parse and validate request body
    const body = await request.json();
    const validatedData = RemoveFilesFromRequestSchema.parse(body);

    // 5. Verify all invoices exist, belong to user, and are in this request
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: validatedData.invoiceIds },
        userId: session.user.id,
        requestId,
      },
    });

    if (invoices.length !== validatedData.invoiceIds.length) {
      return NextResponse.json(
        { error: 'Some invoices not found or not in this request' },
        { status: 404 }
      );
    }

    // 6. Remove invoices from request (set requestId to null)
    await prisma.invoice.updateMany({
      where: {
        id: { in: validatedData.invoiceIds },
      },
      data: {
        requestId: null,
      },
    });

    // 7. Update request statistics
    await updateRequestStatistics(prisma, requestId);

    // 8. Log audit events for each invoice
    const { ipAddress, userAgent } = extractRequestMetadata(request);
    const auditEvents = invoices.map(invoice => ({
      requestId,
      userId: session.user.id,
      eventType: AuditEventTypes.INVOICE_REMOVED_FROM_REQUEST,
      eventCategory: AuditEventCategories.INVOICE_OPERATION,
      severity: 'info' as const,
      summary: `Invoice ${invoice.fileName} removed from request`,
      targetType: 'invoice',
      targetId: invoice.id,
      ipAddress,
      userAgent,
    }));

    await logBulkAuditEvents(auditEvents);

    return NextResponse.json({
      message: `${invoices.length} invoice(s) removed from request`,
      count: invoices.length,
    });
  } catch (error: any) {
    console.error('Error removing files from request:', error);

    // Zod validation error
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to remove files from request' },
      { status: 500 }
    );
  }
}
