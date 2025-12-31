import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getStorageForFile } from "@/lib/storage";

/**
 * Download Invoice PDF API
 *
 * Generates a presigned download URL for the invoice PDF file.
 * For S3 files: Returns a presigned URL with 1-hour expiration
 * For local files: Returns the direct public URL
 *
 * Requires authentication and ownership verification.
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const invoiceId = searchParams.get("id");

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // Get invoice and verify ownership
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        userId: true,
        fileUrl: true,
        fileName: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (invoice.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to download this invoice" },
        { status: 403 }
      );
    }

    if (!invoice.fileUrl) {
      return NextResponse.json(
        { error: "File not found for this invoice" },
        { status: 404 }
      );
    }

    // Generate download URL (presigned for S3, direct for local)
    const storage = getStorageForFile(invoice.fileUrl);
    const downloadUrl = await storage.getDownloadUrl(invoice.fileUrl);

    return NextResponse.json({
      success: true,
      downloadUrl,
      fileName: invoice.fileName,
      expiresIn: invoice.fileUrl.startsWith('s3://') ? 3600 : null, // 1 hour for S3, null for local
    });
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate download URL",
      },
      { status: 500 }
    );
  }
}
