import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { VendorUpdateSchema } from '@/types/vendor';
import { z } from 'zod';

/**
 * GET /api/vendors/[vendorId]
 * Get a single vendor with templates and invoice statistics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { vendorId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: params.vendorId },
      include: {
        templates: {
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        },
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (vendor.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to access this vendor' },
        { status: 403 }
      );
    }

    // Get latest invoice date if any
    const latestInvoice = await prisma.invoice.findFirst({
      where: { vendorId: params.vendorId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return NextResponse.json({
      success: true,
      vendor,
      invoiceStats: {
        total: vendor._count.invoices,
        latestDate: latestInvoice?.createdAt || null,
      },
    });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/vendors/[vendorId]
 * Update a vendor
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { vendorId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: params.vendorId },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (vendor.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to modify this vendor' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = VendorUpdateSchema.parse(body);

    // Check for duplicate name if name is being updated
    if (validatedData.name && validatedData.name !== vendor.name) {
      const existing = await prisma.vendor.findFirst({
        where: {
          userId: session.user.id,
          name: validatedData.name,
          id: { not: params.vendorId },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'A vendor with this name already exists' },
          { status: 400 }
        );
      }
    }

    const updatedVendor = await prisma.vendor.update({
      where: { id: params.vendorId },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && {
          description: validatedData.description || null,
        }),
        ...(validatedData.email !== undefined && {
          email: validatedData.email || null,
        }),
        ...(validatedData.phone !== undefined && {
          phone: validatedData.phone || null,
        }),
        ...(validatedData.website !== undefined && {
          website: validatedData.website || null,
        }),
        ...(validatedData.address !== undefined && {
          address: validatedData.address || null,
        }),
        ...(validatedData.identifiers !== undefined && {
          identifiers: validatedData.identifiers
            ? JSON.stringify(validatedData.identifiers)
            : null,
        }),
      },
      include: {
        _count: {
          select: {
            templates: true,
            invoices: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      vendor: updatedVendor,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating vendor:', error);
    return NextResponse.json(
      { error: 'Failed to update vendor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vendors/[vendorId]
 * Delete a vendor (sets vendorId to null on linked invoices due to onDelete: SetNull)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { vendorId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: params.vendorId },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (vendor.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this vendor' },
        { status: 403 }
      );
    }

    await prisma.vendor.delete({
      where: { id: params.vendorId },
    });

    return NextResponse.json({
      success: true,
      message: 'Vendor deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json(
      { error: 'Failed to delete vendor' },
      { status: 500 }
    );
  }
}
