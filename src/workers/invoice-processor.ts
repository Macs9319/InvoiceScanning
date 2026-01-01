/**
 * BullMQ Worker Process
 * Consumes jobs from the invoice-processing queue
 * Run with: npm run worker
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first (takes precedence), then .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '@/lib/queue/redis-client';
import { InvoiceJobData, InvoiceJobResult } from '@/lib/queue/invoice-queue';
import { processInvoiceJob } from './processor-logic';

const QUEUE_NAME = process.env.QUEUE_NAME || 'invoice-processing';

const worker = new Worker<InvoiceJobData, InvoiceJobResult>(
  QUEUE_NAME,
  async (job: Job<InvoiceJobData>) => {
    console.log(`[Worker] Processing job ${job.id} for invoice ${job.data.invoiceId}`);

    try {
      const result = await processInvoiceJob(job);
      console.log(`[Worker] Job ${job.id} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[Worker] Job ${job.id} failed:`, error);
      throw error; // BullMQ will handle retry logic
    }
  },
  {
    connection: getRedisClient(),
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'), // Process 5 jobs concurrently
    limiter: {
      max: parseInt(process.env.WORKER_MAX_JOBS || '10'),
      duration: parseInt(process.env.WORKER_DURATION || '1000'), // 10 jobs per second
    },
  }
);

// Event listeners for monitoring
worker.on('completed', (job) => {
  console.log(`[Worker] ✓ Job ${job.id} completed for invoice ${job.data.invoiceId}`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] ✗ Job ${job?.id} failed:`, err.message);
  if (job) {
    console.error(`[Worker]   Invoice: ${job.data.invoiceId}, Attempt: ${job.attemptsMade}`);
  }
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

worker.on('stalled', (jobId) => {
  console.warn(`[Worker] Job ${jobId} stalled`);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('[Worker] Shutting down worker gracefully...');
  await worker.close();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

console.log(`[Worker] Started, listening to queue: ${QUEUE_NAME}`);
console.log(`[Worker] Concurrency: ${worker.opts.concurrency}`);
console.log(`[Worker] Redis: ${process.env.REDIS_URL}`);
