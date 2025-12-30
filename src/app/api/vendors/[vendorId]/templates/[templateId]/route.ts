import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { TemplateUpdateSchema } from '@/types/vendor';
import { z } from 'zod';

/**
 * GET /api/vendors/[vendorId]/templates/[templateId]
 * Get a single template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { vendorId: string; templateId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await prisma.vendorTemplate.findUnique({
      where: { id: params.templateId },
      include: {
        vendor: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (template.vendor.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to access this template' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/vendors/[vendorId]/templates/[templateId]
 * Update a template
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { vendorId: string; templateId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await prisma.vendorTemplate.findUnique({
      where: { id: params.templateId },
      include: {
        vendor: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (template.vendor.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to modify this template' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = TemplateUpdateSchema.parse(body);

    // If setting as active, deactivate other templates for this vendor
    if (validatedData.isActive && !template.isActive) {
      await prisma.vendorTemplate.updateMany({
        where: {
          vendorId: params.vendorId,
          isActive: true,
          id: { not: params.templateId },
        },
        data: {
          isActive: false,
        },
      });
    }

    const updatedTemplate = await prisma.vendorTemplate.update({
      where: { id: params.templateId },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && {
          description: validatedData.description || null,
        }),
        ...(validatedData.isActive !== undefined && {
          isActive: validatedData.isActive,
        }),
        ...(validatedData.customPrompt !== undefined && {
          customPrompt: validatedData.customPrompt || null,
        }),
        ...(validatedData.customFields !== undefined && {
          customFields: validatedData.customFields
            ? JSON.stringify(validatedData.customFields)
            : null,
        }),
        ...(validatedData.fieldMappings !== undefined && {
          fieldMappings: validatedData.fieldMappings
            ? JSON.stringify(validatedData.fieldMappings)
            : null,
        }),
        ...(validatedData.validationRules !== undefined && {
          validationRules: validatedData.validationRules
            ? JSON.stringify(validatedData.validationRules)
            : null,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vendors/[vendorId]/templates/[templateId]
 * Delete a template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { vendorId: string; templateId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await prisma.vendorTemplate.findUnique({
      where: { id: params.templateId },
      include: {
        vendor: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (template.vendor.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this template' },
        { status: 403 }
      );
    }

    await prisma.vendorTemplate.delete({
      where: { id: params.templateId },
    });

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
