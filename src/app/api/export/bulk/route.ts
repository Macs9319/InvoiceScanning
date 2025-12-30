import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateExcelBuffer, getExcelFilename } from "@/lib/export/excel";
import { generateCSVString, getCSVFilename } from "@/lib/export/csv";
import { generateJSONString, getJSONFilename } from "@/lib/export/json";
import { auth } from "@/lib/auth";
import { z } from "zod";

const bulkExportSchema = z.object({
  ids: z.array(z.string()).min(1),
  format: z.enum(["excel", "xlsx", "csv", "json"]).default("excel"),
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
    const { ids, format } = bulkExportSchema.parse(body);

    // Fetch selected invoices and verify ownership
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: ids },
        userId: session.user.id, // Only fetch invoices belonging to current user
      },
      include: {
        lineItems: {
          orderBy: {
            order: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (invoices.length === 0) {
      return NextResponse.json(
        { error: "No invoices found to export" },
        { status: 404 }
      );
    }

    // Verify all requested IDs belong to the user
    if (invoices.length !== ids.length) {
      return NextResponse.json(
        { error: "Some invoices were not found or you don't have access to them" },
        { status: 403 }
      );
    }

    // Generate export based on format
    switch (format.toLowerCase()) {
      case "excel":
      case "xlsx": {
        const buffer = generateExcelBuffer(invoices);
        const filename = getExcelFilename();

        return new NextResponse(buffer as unknown as BodyInit, {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      }

      case "csv": {
        const csvContent = generateCSVString(invoices);
        const filename = getCSVFilename();

        return new NextResponse(csvContent, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      }

      case "json": {
        const jsonContent = generateJSONString(invoices);
        const filename = getJSONFilename();

        return new NextResponse(jsonContent, {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid export format. Use: excel, csv, or json" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Bulk export error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to export invoices" },
      { status: 500 }
    );
  }
}
