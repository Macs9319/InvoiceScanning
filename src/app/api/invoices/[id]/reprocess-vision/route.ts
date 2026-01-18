/**
 * Vision API Reprocessing Endpoint
 *
 * Allows reprocessing of failed/scanned invoices using Vision API
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { addInvoiceJob } from '@/lib/queue/invoice-queue';
import { processInvoiceSync } from '@/app/api/process/legacy-processor';
import { calculateVisionCost } from '@/lib/ai/vision-cost-calculator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: invoiceId } = await params;
    const userId = session.user.id;

    // 2. Get invoice and verify ownership
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (invoice.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this invoice' },
        { status: 403 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { images, provider = 'openai', model = 'gpt-4o-mini' } = body;

    // 4. Validate images (optional - will auto-convert PDF if not provided)
    if (images && Array.isArray(images) && images.length > 10) {
      return NextResponse.json(
        {
          error: 'Too many images',
          message: 'Maximum 10 pages allowed for Vision processing'
        },
        { status: 400 }
      );
    }

    // 5. Calculate estimated cost (use 1 page as default if no images provided yet)
    const estimatedPages = images && images.length > 0 ? images.length : 1;
    const costEstimate = calculateVisionCost(provider, model, estimatedPages);

    // 6. Check worker mode
    const workerMode = process.env.WORKER_MODE || 'separate';
    const useQueue = workerMode !== 'disabled';

    // If no images provided, try to convert PDF to images first
    let finalImages = images;
    if (!finalImages || finalImages.length === 0) {
      console.log('No images provided, attempting PDF to image conversion...');

      try {
        // Import self-contained PDF converter (no external dependencies)
        const { convertPDFToImages } = await import('@/lib/pdf/image-converter');
        const { getStorageForFile } = await import('@/lib/storage');

        // Check if file URL exists
        if (!invoice.fileUrl) {
          throw new Error('Invoice has no file URL');
        }

        // Read PDF file from storage
        const storage = getStorageForFile(invoice.fileUrl);
        const fileBuffer = await storage.read(invoice.fileUrl);

        // Convert PDF to images
        finalImages = await convertPDFToImages(fileBuffer, {
          maxPages: 10,
          format: 'jpeg',
          quality: 80,
        });

        console.log(`Converted PDF to ${finalImages.length} images for queueing`);
      } catch (conversionError) {
        console.error('PDF to image conversion failed:', conversionError);
        return NextResponse.json(
          {
            error: 'PDF conversion failed',
            message: conversionError instanceof Error ? conversionError.message : 'Failed to convert PDF to images. The PDF file may be corrupted or invalid.',
          },
          { status: 400 }
        );
      }
    }

    if (useQueue) {
      // Queue the job with Vision processing enabled
      try {
        const jobId = await addInvoiceJob({
          invoiceId,
          userId,
          vendorId: invoice.vendorId || undefined,
          attempt: 0,
          useVision: true,
          images: finalImages,
        });

        // Update invoice status to queued
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'queued',
            jobId,
            processingStartedAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Vision processing queued',
          jobId,
          estimatedCost: costEstimate.estimatedCost,
          invoiceId,
        });
      } catch (queueError) {
        console.error('Failed to queue Vision job, falling back to sync:', queueError);
        // Fall through to synchronous processing
      }
    }

    // Synchronous processing fallback
    try {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'processing',
          processingStartedAt: new Date(),
        },
      });

      // Process with Vision (sync)
      await processInvoiceSyncWithVision(invoiceId, userId, finalImages, invoice.vendorId || undefined);

      return NextResponse.json({
        success: true,
        message: 'Vision processing completed',
        estimatedCost: costEstimate.estimatedCost,
        invoiceId,
      });
    } catch (processingError) {
      console.error('Vision processing failed:', processingError);

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'failed',
          lastError: processingError instanceof Error ? processingError.message : 'Unknown error',
        },
      });

      return NextResponse.json(
        {
          error: 'Processing failed',
          message: processingError instanceof Error ? processingError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Vision reprocessing API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Synchronous Vision processing (fallback when queue unavailable)
 */
async function processInvoiceSyncWithVision(
  invoiceId: string,
  userId: string,
  images: string[],
  vendorId?: string
) {
  const { extractInvoiceDataWithVision } = await import('@/lib/ai/extractor');
  const { applyFieldMappings, separateStandardAndCustomFields } = await import('@/lib/ai/field-mapper');
  const { applyValidationRules } = await import('@/lib/ai/schema-builder');

  // Get vendor template if specified
  let template = null;
  if (vendorId) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        templates: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (vendor?.templates?.[0]) {
      template = vendor.templates[0];
    }
  }

  // Extract with Vision API
  const { data: extractedData, cost } = await extractInvoiceDataWithVision(
    images,
    template,
    userId,
    { pageCount: images.length }
  );

  // Apply field mappings
  const mappedData = applyFieldMappings(extractedData, template?.fieldMappings);

  // Apply validation
  const validation = applyValidationRules(mappedData, template?.validationRules);

  const finalStatus = validation.valid ? 'processed' : 'validation_failed';

  // Separate standard and custom fields
  const { standardFields, customFields } = separateStandardAndCustomFields(mappedData);

  // Parse date
  let parsedDate: Date | null = null;
  if (standardFields.date) {
    try {
      parsedDate = new Date(standardFields.date);
    } catch (e) {
      console.error('Error parsing date:', e);
    }
  }

  // Update invoice with Vision results
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      invoiceNumber: standardFields.invoiceNumber || null,
      date: parsedDate,
      totalAmount: standardFields.totalAmount || null,
      currency: standardFields.currency || 'USD',
      status: finalStatus,
      rawText: 'Processed with Vision API',
      aiResponse: JSON.stringify({
        ...extractedData,
        validation: validation.valid ? null : validation.errors,
        processedWithVision: true,
      }),
      vendorId: vendorId || null,
      templateId: template?.id || null,
      customData: Object.keys(customFields).length > 0 ? JSON.stringify(customFields) : null,
      processedWithVision: true,
      visionApiCost: cost,
      processingCompletedAt: new Date(),
      lastError: null,
      lineItems: {
        deleteMany: {}, // Clear old line items
        create: (standardFields.lineItems || []).map((item: any, index: number) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          order: index,
        })),
      },
    },
  });
}
