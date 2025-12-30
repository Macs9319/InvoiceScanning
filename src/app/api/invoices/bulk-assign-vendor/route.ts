import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const BulkAssignVendorSchema = z.object({
  invoiceIds: z.array(z.string()).min(1),
  vendorId: z.string().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = BulkAssignVendorSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error },
        { status: 400 }
      );
    }

    const { invoiceIds, vendorId } = validation.data;

    // Verify all invoices belong to the user
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (invoices.length !== invoiceIds.length) {
      return NextResponse.json(
        { error: "Some invoices not found or unauthorized" },
        { status: 403 }
      );
    }

    // If vendorId is provided (not null), verify it exists and belongs to user
    if (vendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: {
          id: vendorId,
          userId: session.user.id,
        },
      });

      if (!vendor) {
        return NextResponse.json(
          { error: "Vendor not found or unauthorized" },
          { status: 404 }
        );
      }
    }

    // Update all invoices with the vendor assignment
    await prisma.invoice.updateMany({
      where: {
        id: { in: invoiceIds },
        userId: session.user.id,
      },
      data: {
        vendorId: vendorId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully ${vendorId ? 'assigned vendor to' : 'removed vendor from'} ${invoiceIds.length} invoice(s)`,
      updatedCount: invoiceIds.length,
    });
  } catch (error) {
    console.error("Error in bulk vendor assignment:", error);
    return NextResponse.json(
      { error: "Failed to assign vendor to invoices" },
      { status: 500 }
    );
  }
}
