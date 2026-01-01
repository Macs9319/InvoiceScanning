/**
 * Type definitions for queue operations and job tracking
 */

export type JobStatus =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'paused';

export type WorkerMode = 'embedded' | 'separate' | 'disabled';

export interface JobProgress {
  step: string;
  percentage: number;
  message?: string;
}

export const PROCESSING_STEPS = {
  PDF_READ: { step: 'pdf_read', percentage: 10, message: 'Reading PDF file...' },
  PDF_PARSE: { step: 'pdf_parse', percentage: 25, message: 'Extracting text from PDF...' },
  VENDOR_DETECT: { step: 'vendor_detect', percentage: 40, message: 'Detecting vendor...' },
  TEMPLATE_LOAD: { step: 'template_load', percentage: 50, message: 'Loading vendor template...' },
  AI_EXTRACT: { step: 'ai_extract', percentage: 75, message: 'Extracting data with AI...' },
  VALIDATION: { step: 'validation', percentage: 90, message: 'Validating extracted data...' },
  DB_UPDATE: { step: 'db_update', percentage: 100, message: 'Saving to database...' },
} as const;

export interface InvoiceJobStatus {
  invoiceId: string;
  status: string;
  jobStatus?: string;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  retryCount: number;
  lastError?: string;
  estimatedTime?: {
    elapsed: number;  // seconds
    estimated: number; // seconds
  };
  updatedAt: Date;
}
