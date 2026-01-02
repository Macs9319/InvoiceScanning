/**
 * BullMQ Queue Configuration
 * Handles job creation and queue management for invoice processing
 */
import { Queue, QueueOptions } from 'bullmq';
import { getRedisClient } from './redis-client';

export interface InvoiceJobData {
  invoiceId: string;
  userId: string;
  vendorId?: string; // Optional manual vendor override
  attempt: number;
}

export interface InvoiceJobResult {
  success: boolean;
  invoiceId: string;
  extractedData?: any;
  error?: string;
}

const QUEUE_NAME = process.env.QUEUE_NAME || 'invoice-processing';

function getQueueOptions(): QueueOptions {
  return {
    connection: getRedisClient(),
    defaultJobOptions: {
      attempts: parseInt(process.env.JOB_ATTEMPTS || '3'),
      backoff: {
        type: (process.env.JOB_BACKOFF_TYPE || 'exponential') as 'exponential' | 'fixed',
        delay: parseInt(process.env.JOB_BACKOFF_DELAY || '5000'),
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  };
}

let invoiceQueue: Queue<InvoiceJobData, InvoiceJobResult> | null = null;

export function getInvoiceQueue(): Queue<InvoiceJobData, InvoiceJobResult> {
  if (!invoiceQueue) {
    invoiceQueue = new Queue<InvoiceJobData, InvoiceJobResult>(
      QUEUE_NAME,
      getQueueOptions()
    );
  }
  return invoiceQueue;
}

export async function addInvoiceJob(
  data: InvoiceJobData
): Promise<string> {
  const queue = getInvoiceQueue();

  const job = await queue.add('process-invoice', data, {
    jobId: `invoice-${data.invoiceId}-${Date.now()}`, // Unique job ID
    timeout: parseInt(process.env.JOB_TIMEOUT || '120000'),
  });

  return job.id!;
}

export async function getJobStatus(jobId: string) {
  const queue = getInvoiceQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    return { status: 'not_found', job: null };
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    status: state,
    progress,
    job: {
      id: job.id,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    },
  };
}

export async function closeQueue(): Promise<void> {
  if (invoiceQueue) {
    await invoiceQueue.close();
    invoiceQueue = null;
  }
}
