import { RequestStatistics } from '@/types/request';

/**
 * Invoice data needed for statistics calculation
 */
interface InvoiceForStats {
  status: string;
  totalAmount: number | null;
  currency: string | null;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
}

/**
 * Calculate comprehensive statistics for a request based on its invoices
 *
 * @param invoices - Array of invoices belonging to the request
 * @returns RequestStatistics object with computed metrics
 */
export function calculateRequestStatistics(invoices: InvoiceForStats[]): RequestStatistics {
  const totalInvoices = invoices.length;

  // Count invoices by status
  const processedCount = invoices.filter(inv => inv.status === 'processed').length;
  const failedCount = invoices.filter(inv =>
    inv.status === 'failed' || inv.status === 'validation_failed'
  ).length;
  const pendingCount = invoices.filter(inv => inv.status === 'pending').length;
  const queuedCount = invoices.filter(inv => inv.status === 'queued').length;
  const processingCount = invoices.filter(inv => inv.status === 'processing').length;

  // Calculate success rate
  const successRate = totalInvoices > 0
    ? Math.round((processedCount / totalInvoices) * 100)
    : 0;

  // Calculate total amount (only from successfully processed invoices)
  const processedInvoices = invoices.filter(inv => inv.status === 'processed');
  const amounts = processedInvoices
    .map(inv => inv.totalAmount)
    .filter((amount): amount is number => amount !== null);

  const totalAmount = amounts.length > 0
    ? amounts.reduce((sum, amount) => sum + amount, 0)
    : null;

  // Determine currency (use most common currency from processed invoices)
  const currency = determineCurrency(processedInvoices);

  // Calculate average amount
  const averageAmount = amounts.length > 0
    ? totalAmount! / amounts.length
    : null;

  // Calculate average processing time (in milliseconds)
  const averageProcessingTime = calculateAverageProcessingTime(processedInvoices);

  return {
    totalInvoices,
    processedCount,
    failedCount,
    pendingCount,
    queuedCount,
    processingCount,
    successRate,
    totalAmount,
    currency,
    averageAmount,
    averageProcessingTime,
  };
}

/**
 * Determine the primary currency for a request
 * Uses the most frequently occurring currency from processed invoices
 *
 * @param invoices - Array of processed invoices
 * @returns Currency code or null
 */
function determineCurrency(invoices: InvoiceForStats[]): string | null {
  if (invoices.length === 0) return null;

  const currencyCounts = new Map<string, number>();

  invoices.forEach(inv => {
    if (inv.currency) {
      currencyCounts.set(inv.currency, (currencyCounts.get(inv.currency) || 0) + 1);
    }
  });

  if (currencyCounts.size === 0) return null;

  // Find currency with highest count
  let maxCount = 0;
  let primaryCurrency: string | null = null;

  currencyCounts.forEach((count, currency) => {
    if (count > maxCount) {
      maxCount = count;
      primaryCurrency = currency;
    }
  });

  return primaryCurrency;
}

/**
 * Calculate average processing time for completed invoices
 *
 * @param invoices - Array of processed invoices
 * @returns Average processing time in milliseconds, or null if no data
 */
function calculateAverageProcessingTime(invoices: InvoiceForStats[]): number | null {
  const processingTimes: number[] = [];

  invoices.forEach(inv => {
    if (inv.processingStartedAt && inv.processingCompletedAt) {
      const duration = inv.processingCompletedAt.getTime() - inv.processingStartedAt.getTime();
      processingTimes.push(duration);
    }
  });

  if (processingTimes.length === 0) return null;

  const totalTime = processingTimes.reduce((sum, time) => sum + time, 0);
  return Math.round(totalTime / processingTimes.length);
}

/**
 * Update request statistics in database
 * This should be called after any invoice status change
 *
 * @param prisma - Prisma client instance
 * @param requestId - Request ID to update
 * @returns Updated request record
 */
export async function updateRequestStatistics(
  prisma: any,
  requestId: string
): Promise<any> {
  // Fetch all invoices for the request
  const invoices = await prisma.invoice.findMany({
    where: { requestId },
    select: {
      status: true,
      totalAmount: true,
      currency: true,
      processingStartedAt: true,
      processingCompletedAt: true,
    },
  });

  // Calculate statistics
  const stats = calculateRequestStatistics(invoices);

  // Update request record
  return await prisma.uploadRequest.update({
    where: { id: requestId },
    data: {
      totalInvoices: stats.totalInvoices,
      processedCount: stats.processedCount,
      failedCount: stats.failedCount,
      pendingCount: stats.pendingCount,
      queuedCount: stats.queuedCount,
      processingCount: stats.processingCount,
      totalAmount: stats.totalAmount,
      currency: stats.currency,
      updatedAt: new Date(),
    },
  });
}

/**
 * Update request statistics within a Prisma transaction
 * Use this when updating statistics as part of a larger atomic operation
 *
 * @param tx - Prisma transaction client
 * @param requestId - Request ID to update
 * @returns Updated request record
 */
export async function updateRequestStatisticsInTransaction(
  tx: any,
  requestId: string
): Promise<any> {
  const invoices = await tx.invoice.findMany({
    where: { requestId },
    select: {
      status: true,
      totalAmount: true,
      currency: true,
      processingStartedAt: true,
      processingCompletedAt: true,
    },
  });

  const stats = calculateRequestStatistics(invoices);

  return await tx.uploadRequest.update({
    where: { id: requestId },
    data: {
      totalInvoices: stats.totalInvoices,
      processedCount: stats.processedCount,
      failedCount: stats.failedCount,
      pendingCount: stats.pendingCount,
      queuedCount: stats.queuedCount,
      processingCount: stats.processingCount,
      totalAmount: stats.totalAmount,
      currency: stats.currency,
      updatedAt: new Date(),
    },
  });
}

/**
 * Format processing time for display
 * Converts milliseconds to human-readable format
 *
 * @param ms - Processing time in milliseconds
 * @returns Formatted string (e.g., "2.5s", "1m 30s", "2h 15m")
 */
export function formatProcessingTime(ms: number | null): string {
  if (ms === null) return 'N/A';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else if (seconds > 0) {
    return `${seconds}s`;
  } else {
    return `${ms}ms`;
  }
}

/**
 * Format amount with currency
 *
 * @param amount - Amount value
 * @param currency - Currency code
 * @returns Formatted string (e.g., "$1,234.56")
 */
export function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return 'N/A';

  const currencySymbol = getCurrencySymbol(currency);
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${currencySymbol}${formattedAmount}`;
}

/**
 * Get currency symbol from currency code
 *
 * @param currency - Currency code (e.g., "USD", "EUR")
 * @returns Currency symbol (e.g., "$", "€")
 */
function getCurrencySymbol(currency: string | null): string {
  if (!currency) return '';

  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF ',
    CNY: '¥',
    INR: '₹',
  };

  return symbols[currency] || currency + ' ';
}
