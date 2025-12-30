import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { unlink, readdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const limit = searchParams.get("limit");

    const where: any = { userId: session.user.id };
    if (status) {
      where.status = status;
    }
    const take = limit ? parseInt(limit, 10) : undefined;

    const invoices = await prisma.invoice.findMany({
      where,
      take,
      include: {
        lineItems: {
          orderBy: {
            order: "asc",
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      invoices,
      count: invoices.length,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const all = searchParams.get("all");

    // Delete all invoices for the current user
    if (all === "true") {
      // Get all user's invoices to delete their files
      const userInvoices = await prisma.invoice.findMany({
        where: { userId: session.user.id },
      });

      // Delete all line items and invoices for this user
      await prisma.lineItem.deleteMany({
        where: {
          invoice: {
            userId: session.user.id,
          },
        },
      });
      await prisma.invoice.deleteMany({
        where: { userId: session.user.id },
      });

      // Delete uploaded files for user's invoices
      try {
        for (const invoice of userInvoices) {
          if (invoice.fileUrl) {
            const filePath = join(process.cwd(), "public", invoice.fileUrl);
            try {
              await unlink(filePath);
            } catch (error) {
              console.error(`Error deleting file ${invoice.fileUrl}:`, error);
            }
          }
        }
      } catch (error) {
        console.error("Error deleting upload files:", error);
      }

      return NextResponse.json({
        success: true,
        message: "All invoices and files deleted successfully",
      });
    }

    // Delete single invoice
    if (!id) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // Get invoice and verify ownership
    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (invoice.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to delete this invoice" },
        { status: 403 }
      );
    }

    // Delete the file
    if (invoice.fileUrl) {
      try {
        const filePath = join(process.cwd(), "public", invoice.fileUrl);
        await unlink(filePath);
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    }

    await prisma.invoice.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
