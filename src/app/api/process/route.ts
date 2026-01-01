/**
 * Invoice Processing API - Job Dispatcher
 * Refactored to dispatch jobs to BullMQ queue instead of synchronous processing
 * Supports fallback to synchronous mode when WORKER_MODE=disabled
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { addInvoiceJob } from "@/lib/queue/invoice-queue";
import { processInvoiceSync } from "./legacy-processor";

const WORKER_MODE = process.env.WORKER_MODE || 'separate';

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

    // FALLBACK MODE: Synchronous processing if worker disabled
    if (WORKER_MODE === 'disabled') {
      console.warn('[API] Worker mode disabled, using synchronous processing');

      try {
        const result = await processInvoiceSync(invoiceId, session.user.id, vendorId);
        return NextResponse.json(result);
      } catch (error) {
        console.error("Error processing invoice (sync):", error);
        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : "Failed to process invoice",
          },
          { status: 500 }
        );
      }
    }

    // ASYNC MODE: Dispatch job to queue
    try {
      const jobData = {
        invoiceId,
        userId: session.user.id,
        vendorId,
        attempt: 0,
      };

      const jobId = await addInvoiceJob(jobData);

      // Update invoice with job ID and set status to queued
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'queued',
          jobId,
        },
      });

      console.log(`[API] Invoice ${invoiceId} queued with job ID: ${jobId}`);

      return NextResponse.json({
        success: true,
        invoiceId,
        jobId,
        message: 'Invoice queued for processing',
        status: 'queued',
      });
    } catch (queueError) {
      console.error("Error queueing invoice:", queueError);

      // If queueing fails, try synchronous fallback
      if (queueError instanceof Error && queueError.message.includes('REDIS')) {
        console.warn('[API] Redis error, falling back to synchronous processing');

        try {
          const result = await processInvoiceSync(invoiceId, session.user.id, vendorId);
          return NextResponse.json({
            ...result,
            warning: 'Processed synchronously due to queue unavailability',
          });
        } catch (syncError) {
          throw syncError;
        }
      }

      throw queueError;
    }
  } catch (error) {
    console.error("Error in /api/process:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to queue invoice for processing",
      },
      { status: 500 }
    );
  }
}
