import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { extractTextFromPDF } from "@/lib/pdf/parser";
import { extractInvoiceData } from "@/lib/ai/extractor";
import { auth } from "@/lib/auth";
import { detectVendorFromText } from "@/lib/ai/vendor-detector";
import { applyFieldMappings, separateStandardAndCustomFields } from "@/lib/ai/field-mapper";
import { applyValidationRules } from "@/lib/ai/schema-builder";
import { getStorageForFile } from "@/lib/storage";

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
    const { invoiceId, vendorId } = body; // vendorId is optional (manual override)

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // Get invoice from database and verify ownership
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to process this invoice" },
        { status: 403 }
      );
    }

    if (!invoice.fileUrl) {
      return NextResponse.json(
        { error: "Invoice file URL not found" },
        { status: 404 }
      );
    }

    // Update status to processing and clear any previous errors/line items
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "processing",
        aiResponse: null,
        lineItems: {
          deleteMany: {}, // Clear existing line items on retry
        },
      },
    });

    try {
      // Read PDF file from storage (S3 or local - auto-detected from URL)
      const storage = getStorageForFile(invoice.fileUrl);
      let fileBuffer: Buffer;

      try {
        fileBuffer = await storage.read(invoice.fileUrl);
      } catch (fileError) {
        throw new Error(`Failed to read PDF file: ${fileError instanceof Error ? fileError.message : 'File not found'}`);
      }

      // Extract text from PDF
      let pdfText: string;
      try {
        pdfText = await extractTextFromPDF(fileBuffer);
        if (!pdfText || pdfText.trim().length === 0) {
          throw new Error("PDF contains no extractable text. The document may be an image-based scan.");
        }
      } catch (pdfError) {
        throw new Error(`PDF text extraction failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
      }

      // Vendor detection and template loading
      let finalVendorId = vendorId; // Manual override takes precedence
      let detectedVendorId: string | null = null;
      let template = null;

      // If no manual vendor specified, try auto-detection
      if (!finalVendorId) {
        try {
          const detection = await detectVendorFromText(pdfText, session.user.id);
          detectedVendorId = detection.vendorId;
          finalVendorId = detection.vendorId;

          console.log(`Vendor detection: ${detection.matchReason}, confidence: ${detection.confidence}, vendor: ${detection.detectedName || 'none'}`);
        } catch (detectionError) {
          console.error('Vendor detection failed:', detectionError);
          // Continue without vendor - not a fatal error
        }
      }

      // Load active template for vendor
      if (finalVendorId) {
        try {
          template = await prisma.vendorTemplate.findFirst({
            where: {
              vendorId: finalVendorId,
              isActive: true,
            },
          });
        } catch (templateError) {
          console.error('Failed to load vendor template:', templateError);
          // Continue without template - not a fatal error
        }
      }

      // Extract invoice data using AI with template
      let extractedData;
      try {
        extractedData = await extractInvoiceData(pdfText, template);
      } catch (aiError) {
        throw new Error(`AI extraction failed: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`);
      }

      // Apply field mappings if template has them
      const mappedData = applyFieldMappings(extractedData, template?.fieldMappings);

      // Apply validation rules if template has them
      const validation = applyValidationRules(mappedData, template?.validationRules);

      // Determine final status based on validation
      let finalStatus = 'processed';
      if (!validation.valid) {
        finalStatus = 'validation_failed';
      }

      // Separate standard fields from custom fields
      const { standardFields, customFields } = separateStandardAndCustomFields(mappedData);

      // Parse date if present
      let parsedDate: Date | null = null;
      if (standardFields.date) {
        try {
          parsedDate = new Date(standardFields.date);
        } catch (e) {
          console.error("Error parsing date:", e);
        }
      }

      // Update invoice with extracted data
      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          invoiceNumber: standardFields.invoiceNumber || null,
          date: parsedDate,
          totalAmount: standardFields.totalAmount || null,
          currency: standardFields.currency || "USD",
          status: finalStatus,
          rawText: pdfText,
          aiResponse: JSON.stringify({
            ...extractedData,
            validation: validation.valid ? null : validation.errors,
          }),
          vendorId: finalVendorId || null,
          detectedVendorId: detectedVendorId,
          templateId: template?.id || null,
          customData: Object.keys(customFields).length > 0
            ? JSON.stringify(customFields)
            : null,
          lineItems: {
            create: (standardFields.lineItems || []).map((item: any, index: number) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amount,
              order: index,
            })),
          },
        },
        include: {
          lineItems: true,
          vendor: true,
        },
      });

      // Update template usage stats if template was used
      if (template) {
        await prisma.vendorTemplate.update({
          where: { id: template.id },
          data: {
            invoiceCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        }).catch(err => {
          console.error('Failed to update template stats:', err);
          // Non-fatal error, continue
        });
      }

      return NextResponse.json({
        success: true,
        invoice: updatedInvoice,
        extractedData: mappedData,
        validation,
        vendorDetection: detectedVendorId ? {
          detectedVendorId,
          templateUsed: template?.name || null,
        } : null,
      });
    } catch (processingError) {
      // Store detailed error message
      const errorMessage = processingError instanceof Error
        ? processingError.message
        : "Unknown processing error";

      // Update status to failed with error details
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "failed",
          aiResponse: JSON.stringify({
            error: errorMessage,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      throw processingError;
    }
  } catch (error) {
    console.error("Error processing invoice:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process invoice",
      },
      { status: 500 }
    );
  }
}
