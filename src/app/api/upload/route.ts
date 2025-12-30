import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

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

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const uploadedFiles = [];

    for (const file of files) {
      // Validate file type
      if (file.type !== "application/pdf") {
        return NextResponse.json(
          { error: `File ${file.name} is not a PDF` },
          { status: 400 }
        );
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 10MB limit` },
          { status: 400 }
        );
      }

      // Create unique filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `${timestamp}_${sanitizedName}`;

      // Save file to public/uploads
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });

      const filepath = path.join(uploadsDir, filename);
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      await writeFile(filepath, buffer);

      // Create database entry
      const invoice = await prisma.invoice.create({
        data: {
          fileName: file.name,
          fileUrl: `/uploads/${filename}`,
          status: "pending",
          userId: session.user.id,
        },
      });

      uploadedFiles.push({
        id: invoice.id,
        fileName: file.name,
        fileUrl: invoice.fileUrl,
      });
    }

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error("Error uploading files:", error);
    return NextResponse.json(
      { error: "Failed to upload files" },
      { status: 500 }
    );
  }
}
