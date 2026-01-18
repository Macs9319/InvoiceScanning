import { useState, useEffect, useCallback, useRef } from 'react';

const DEFAULT_INTERVAL = parseInt(process.env.NEXT_PUBLIC_POLLING_INTERVAL || '10000');

interface InvoiceStatus {
  invoiceId: string;
  status: string;
  jobStatus: string | null;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  retryCount: number;
  lastError: string | null;
  estimatedTime?: {
    elapsed: number;
    estimated: number;
  };
  updatedAt: Date;
}

interface UseInvoicePollingOptions {
  enabled?: boolean;
  interval?: number;
  onStatusChange?: (statuses: InvoiceStatus[]) => void;
}

/**
 * Hook for polling invoice processing status
 * Polls /api/invoices/status endpoint at regular intervals
 * Detects status changes and triggers callbacks
 */
export function useInvoicePolling(
  invoiceIds: string[],
  options: UseInvoicePollingOptions = {}
) {
  const { enabled = true, interval = DEFAULT_INTERVAL, onStatusChange } = options;
  const [statuses, setStatuses] = useState<InvoiceStatus[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousStatusesRef = useRef<Map<string, string>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatuses = useCallback(async () => {
    if (invoiceIds.length === 0) return;

    try {
      setIsPolling(true);
      setError(null);

      const response = await fetch(`/api/invoices/status?ids=${invoiceIds.join(',')}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch statuses: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      const newStatuses = data.statuses as InvoiceStatus[];

      // Detect changes
      const changedInvoices = newStatuses.filter((status) => {
        const prevStatus = previousStatusesRef.current.get(status.invoiceId);
        if (prevStatus !== status.status) {
          previousStatusesRef.current.set(status.invoiceId, status.status);
          return true;
        }
        return false;
      });

      setStatuses(newStatuses);

      // Trigger callback if statuses changed
      if (changedInvoices.length > 0 && onStatusChange) {
        onStatusChange(changedInvoices);
      }
    } catch (err) {
      console.error('Polling error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice statuses');
    } finally {
      setIsPolling(false);
    }
  }, [invoiceIds, onStatusChange]);

  // Check if there are any invoices currently being processed
  const hasProcessingInvoices = statuses.some(
    (s) => s.status === 'queued' || s.status === 'processing'
  );

  // Effect to start/stop polling based on processing status
  useEffect(() => {
    if (!enabled || invoiceIds.length === 0) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Fetch immediately on mount or when invoiceIds change
    fetchStatuses();

    // If there are processing invoices, start polling
    if (hasProcessingInvoices) {
      // Clear any existing interval first
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Set up new polling interval
      intervalRef.current = setInterval(fetchStatuses, interval);
      console.log('Started polling for', invoiceIds.length, 'invoices');
    } else if (statuses.length > 0) {
      // All invoices are done processing, stop polling
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('All invoices processed, stopped polling');
      }
    }

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, invoiceIds, interval, fetchStatuses, hasProcessingInvoices, statuses.length]);

  return {
    statuses,
    isPolling,
    hasProcessingInvoices,
    error,
    refresh: fetchStatuses
  };
}
