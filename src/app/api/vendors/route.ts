import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { VendorCreateSchema } from '@/types/vendor';
import { z } from 'zod';

/**
 * GET /api/vendors
 * List all vendors for the current user with template and invoice counts
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {
      userId: session.user.id,
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const vendors = await prisma.vendor.findMany({
      where,
      include: {
        _count: {
          select: {
            templates: true,
            invoices: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      vendors,
      count: vendors.length,
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vendors
 * Create a new vendor
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = VendorCreateSchema.parse(body);

    // Check for duplicate vendor name within user
    const existing = await prisma.vendor.findFirst({
      where: {
        userId: session.user.id,
        name: validatedData.name,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A vendor with this name already exists' },
        { status: 400 }
      );
    }

    // Create vendor
    const vendor = await prisma.vendor.create({
      data: {
        userId: session.user.id,
        name: validatedData.name,
        description: validatedData.description || null,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        website: validatedData.website || null,
        address: validatedData.address || null,
        identifiers: validatedData.identifiers
          ? JSON.stringify(validatedData.identifiers)
          : null,
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

    return NextResponse.json(
      {
        success: true,
        vendor,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating vendor:', error);
    return NextResponse.json(
      { error: 'Failed to create vendor' },
      { status: 500 }
    );
  }
}
