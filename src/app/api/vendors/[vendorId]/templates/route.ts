import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { TemplateCreateSchema } from '@/types/vendor';
import { z } from 'zod';

/**
 * GET /api/vendors/[vendorId]/templates
 * List all templates for a vendor
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

    // Verify vendor ownership
    const vendor = await prisma.vendor.findUnique({
      where: { id: params.vendorId },
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

    const templates = await prisma.vendorTemplate.findMany({
      where: { vendorId: params.vendorId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vendors/[vendorId]/templates
 * Create a new template for a vendor
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { vendorId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify vendor ownership
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
    const validatedData = TemplateCreateSchema.parse(body);

    // If setting as active, deactivate other templates for this vendor
    if (validatedData.isActive) {
      await prisma.vendorTemplate.updateMany({
        where: {
          vendorId: params.vendorId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    }

    const template = await prisma.vendorTemplate.create({
      data: {
        vendorId: params.vendorId,
        name: validatedData.name,
        description: validatedData.description || null,
        isActive: validatedData.isActive ?? true,
        customPrompt: validatedData.customPrompt || null,
        customFields: validatedData.customFields
          ? JSON.stringify(validatedData.customFields)
          : null,
        fieldMappings: validatedData.fieldMappings
          ? JSON.stringify(validatedData.fieldMappings)
          : null,
        validationRules: validatedData.validationRules
          ? JSON.stringify(validatedData.validationRules)
          : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        template,
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

    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
