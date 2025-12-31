import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { getStorageForFile } from "@/lib/storage";
import { z } from "zod";

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1),
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
    const { ids } = bulkDeleteSchema.parse(body);

    // Get all invoices and verify ownership
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: ids },
      },
    });

    // Verify all invoices belong to the current user
    const unauthorized = invoices.some((inv) => inv.userId !== session.user!.id);
    if (unauthorized) {
      return NextResponse.json(
        { error: "Unauthorized to delete one or more invoices" },
        { status: 403 }
      );
    }

    // Delete files from storage (S3 or local)
    for (const invoice of invoices) {
      if (invoice.fileUrl) {
        try {
          const storage = getStorageForFile(invoice.fileUrl);
          await storage.delete(invoice.fileUrl);
        } catch (error) {
          console.error(`Error deleting file ${invoice.fileUrl}:`, error);
          // Continue even if file deletion fails
        }
      }
    }

    // Delete invoices (line items will be deleted automatically via cascade)
    await prisma.invoice.deleteMany({
      where: {
        id: { in: ids },
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`,
      count: invoices.length,
    });
  } catch (error) {
    console.error("Bulk delete error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete invoices" },
      { status: 500 }
    );
  }
}
