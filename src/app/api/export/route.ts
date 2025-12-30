import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateExcelBuffer, getExcelFilename } from "@/lib/export/excel";
import { generateCSVString, getCSVFilename } from "@/lib/export/csv";
import { generateJSONString, getJSONFilename } from "@/lib/export/json";
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
    const format = searchParams.get("format") || "excel";

    // Fetch all processed invoices for the current user
    const invoices = await prisma.invoice.findMany({
      where: {
        userId: session.user.id,
        status: "processed",
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
        { error: "No processed invoices found to export" },
        { status: 404 }
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
    console.error("Error exporting invoices:", error);
    return NextResponse.json(
      { error: "Failed to export invoices" },
      { status: 500 }
    );
  }
}
