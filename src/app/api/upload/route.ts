import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { getDefaultStorage } from "@/lib/storage";
import { logAuditEvent, logBulkAuditEvents, AuditEventTypes, AuditEventCategories } from "@/lib/audit/logger";
import { extractRequestMetadata } from "@/lib/audit/middleware";
import { updateRequestStatistics } from "@/lib/requests/statistics";
import { generateAutoRequestTitle } from "@/types/request";

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
    const requestIdParam = formData.get("requestId") as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    // Handle request association
    let uploadRequestId: string | null = null;
    let autoCreatedRequest = false;

    if (requestIdParam) {
      // Verify request exists and belongs to user
      const uploadRequest = await prisma.uploadRequest.findUnique({
        where: { id: requestIdParam },
      });

      if (!uploadRequest) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 }
        );
      }

      if (uploadRequest.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }

      if (uploadRequest.status !== 'draft') {
        return NextResponse.json(
          { error: "Can only upload to draft requests" },
          { status: 400 }
        );
      }

      uploadRequestId = requestIdParam;
    } else {
      // Auto-create request (hybrid approach)
      const autoRequest = await prisma.uploadRequest.create({
        data: {
          userId: session.user.id,
          title: generateAutoRequestTitle(),
          status: 'draft',
          autoProcess: false,
        },
      });

      uploadRequestId = autoRequest.id;
      autoCreatedRequest = true;

      // Log request creation
      const { ipAddress, userAgent } = extractRequestMetadata(request);
      await logAuditEvent({
        requestId: autoRequest.id,
        userId: session.user.id,
        eventType: AuditEventTypes.REQUEST_CREATED,
        eventCategory: AuditEventCategories.REQUEST_LIFECYCLE,
        severity: 'info',
        summary: `Auto-created request: ${autoRequest.title}`,
        targetType: 'request',
        targetId: autoRequest.id,
        newValue: autoRequest,
        ipAddress,
        userAgent,
      });
    }

    const storage = getDefaultStorage();
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

      // Convert file to buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Upload to storage (S3 or local based on STORAGE_PROVIDER env var)
      // S3 key format: users/{userId}/invoices/{timestamp}_{filename}
      const storageKey = `users/${session.user.id}/invoices/${filename}`;
      const fileUrl = await storage.upload(buffer, storageKey, {
        contentType: file.type,
        userId: session.user.id,
        fileName: file.name,
      });

      // Create database entry with request association
      const invoice = await prisma.invoice.create({
        data: {
          fileName: file.name,
          fileUrl, // Now contains s3:// URL or /uploads/ path depending on storage provider
          status: "pending",
          userId: session.user.id,
          requestId: uploadRequestId,
        },
      });

      uploadedFiles.push({
        id: invoice.id,
        fileName: file.name,
        fileUrl: invoice.fileUrl,
      });
    }

    // Update request statistics
    if (uploadRequestId) {
      await updateRequestStatistics(prisma, uploadRequestId);
    }

    // Log audit events for uploaded invoices
    const { ipAddress, userAgent } = extractRequestMetadata(request);
    const auditEvents = uploadedFiles.map(file => ({
      requestId: uploadRequestId!,
      userId: session.user.id,
      eventType: AuditEventTypes.INVOICE_UPLOADED,
      eventCategory: AuditEventCategories.INVOICE_OPERATION,
      severity: 'info' as const,
      summary: `Invoice uploaded: ${file.fileName}`,
      targetType: 'invoice',
      targetId: file.id,
      ipAddress,
      userAgent,
    }));

    await logBulkAuditEvents(auditEvents);

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
      requestId: uploadRequestId,
      autoCreated: autoCreatedRequest,
    });
  } catch (error) {
    console.error("Error uploading files:", error);
    return NextResponse.json(
      { error: "Failed to upload files" },
      { status: 500 }
    );
  }
}
