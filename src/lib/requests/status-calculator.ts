import { RequestStatus } from '@/types/request';

/**
 * Invoice status values from database
 */
interface InvoiceStatus {
  status: string;
}

/**
 * Calculate request status based on invoice statuses
 *
 * Status logic:
 * - draft: No invoices OR all invoices are pending
 * - processing: At least one invoice is queued or processing
 * - completed: All invoices successfully processed
 * - partial: Mix of processed and failed invoices
 * - failed: All invoices failed (and at least one exists)
 *
 * @param invoices - Array of invoices with status field
 * @returns Request status string
 */
export function calculateRequestStatus(invoices: InvoiceStatus[]): string {
  // No invoices = draft
  if (invoices.length === 0) {
    return RequestStatus.DRAFT;
  }

  const statuses = invoices.map(inv => inv.status);

  // Count each status type
  const hasQueued = statuses.includes('queued');
  const hasProcessing = statuses.includes('processing');
  const hasPending = statuses.includes('pending');
  const hasProcessed = statuses.includes('processed');
  const hasFailed = statuses.includes('failed') || statuses.includes('validation_failed');

  // Processing: Any invoices actively being worked on
  if (hasQueued || hasProcessing) {
    return RequestStatus.PROCESSING;
  }

  // Draft: All invoices still pending (not yet submitted)
  if (hasPending && !hasProcessed && !hasFailed) {
    return RequestStatus.DRAFT;
  }

  // Failed: All invoices failed, none succeeded
  if (hasFailed && !hasProcessed) {
    return RequestStatus.FAILED;
  }

  // Completed: All invoices processed successfully
  if (hasProcessed && !hasFailed && !hasPending && !hasQueued && !hasProcessing) {
    return RequestStatus.COMPLETED;
  }

  // Partial: Some succeeded, some failed
  if (hasProcessed && hasFailed) {
    return RequestStatus.PARTIAL;
  }

  // Default to draft for edge cases
  return RequestStatus.DRAFT;
}

/**
 * Check if a request can be submitted for processing
 * A request can be submitted if it has pending invoices and is in draft status
 *
 * @param status - Current request status
 * @param pendingCount - Number of pending invoices
 * @returns True if request can be submitted
 */
export function canSubmitRequest(status: string, pendingCount: number): boolean {
  return status === RequestStatus.DRAFT && pendingCount > 0;
}

/**
 * Check if a request can be retried
 * A request can be retried if it has failed or partial status
 *
 * @param status - Current request status
 * @param failedCount - Number of failed invoices
 * @returns True if request can be retried
 */
export function canRetryRequest(status: string, failedCount: number): boolean {
  return (status === RequestStatus.FAILED || status === RequestStatus.PARTIAL) && failedCount > 0;
}

/**
 * Check if a request can be deleted
 * A request can only be deleted if it's not currently processing
 *
 * @param status - Current request status
 * @returns True if request can be deleted
 */
export function canDeleteRequest(status: string): boolean {
  return status !== RequestStatus.PROCESSING;
}

/**
 * Check if files can be added/removed from a request
 * Files can only be modified in draft status
 *
 * @param status - Current request status
 * @returns True if files can be modified
 */
export function canModifyFiles(status: string): boolean {
  return status === RequestStatus.DRAFT;
}

/**
 * Determine if request is in a terminal state (completed, failed, partial)
 * Terminal states indicate processing has finished
 *
 * @param status - Current request status
 * @returns True if status is terminal
 */
export function isTerminalStatus(status: string): boolean {
  return status === RequestStatus.COMPLETED ||
         status === RequestStatus.FAILED ||
         status === RequestStatus.PARTIAL;
}

/**
 * Determine if request is actively being processed
 *
 * @param status - Current request status
 * @returns True if status is processing
 */
export function isProcessing(status: string): boolean {
  return status === RequestStatus.PROCESSING;
}
