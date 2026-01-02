import { z } from 'zod';

/**
 * Request status enumeration
 * Defines the lifecycle states of an upload request
 */
export const RequestStatus = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
} as const;

export type RequestStatusType = typeof RequestStatus[keyof typeof RequestStatus];

/**
 * Zod schema for creating a new request
 * Used in POST /api/requests
 */
export const CreateRequestSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  defaultVendorId: z.string().optional(),
  autoProcess: z.boolean().default(false),
});

export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;

/**
 * Zod schema for updating an existing request
 * Used in PATCH /api/requests/[requestId]
 */
export const UpdateRequestSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  defaultVendorId: z.string().nullable().optional(),
  autoProcess: z.boolean().optional(),
});

export type UpdateRequestInput = z.infer<typeof UpdateRequestSchema>;

/**
 * Zod schema for request query parameters
 * Used in GET /api/requests with filtering and pagination
 */
export const RequestQuerySchema = z.object({
  // Filtering
  status: z.enum(['draft', 'processing', 'completed', 'partial', 'failed']).optional(),
  search: z.string().optional(),
  vendorId: z.string().optional(),

  // Date range filtering
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),

  // Pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),

  // Sorting
  sortBy: z.enum(['createdAt', 'updatedAt', 'submittedAt', 'title', 'status', 'totalAmount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type RequestQuery = z.infer<typeof RequestQuerySchema>;

/**
 * Zod schema for adding files to a request
 * Used in POST /api/requests/[requestId]/files
 */
export const AddFilesToRequestSchema = z.object({
  invoiceIds: z.array(z.string()).min(1),
});

export type AddFilesToRequestInput = z.infer<typeof AddFilesToRequestSchema>;

/**
 * Zod schema for removing files from a request
 * Used in DELETE /api/requests/[requestId]/files
 */
export const RemoveFilesFromRequestSchema = z.object({
  invoiceIds: z.array(z.string()).min(1),
});

export type RemoveFilesFromRequestInput = z.infer<typeof RemoveFilesFromRequestSchema>;

/**
 * Zod schema for bulk operations
 * Used in POST /api/requests/bulk-export and bulk-delete
 */
export const BulkRequestOperationSchema = z.object({
  requestIds: z.array(z.string()).min(1),
});

export type BulkRequestOperationInput = z.infer<typeof BulkRequestOperationSchema>;

/**
 * TypeScript type for request record (matches Prisma model)
 */
export interface RequestRecord {
  id: string;
  userId: string;
  title: string | null;
  description: string | null;
  status: string;
  defaultVendorId: string | null;
  autoProcess: boolean;
  totalInvoices: number;
  processedCount: number;
  failedCount: number;
  pendingCount: number;
  queuedCount: number;
  processingCount: number;
  totalAmount: number | null;
  currency: string | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TypeScript type for request with related data
 * Used in detail views with vendor and invoice information
 */
export interface RequestWithRelations extends RequestRecord {
  defaultVendor?: {
    id: string;
    name: string;
  } | null;
  invoices?: {
    id: string;
    fileName: string;
    status: string;
    totalAmount: number | null;
    currency: string | null;
    createdAt: Date;
  }[];
  _count?: {
    invoices: number;
    auditLogs: number;
  };
}

/**
 * TypeScript type for request statistics
 * Computed from invoice data
 */
export interface RequestStatistics {
  totalInvoices: number;
  processedCount: number;
  failedCount: number;
  pendingCount: number;
  queuedCount: number;
  processingCount: number;
  successRate: number; // Percentage (0-100)
  totalAmount: number | null;
  currency: string | null;
  averageAmount: number | null;
  averageProcessingTime: number | null; // Milliseconds
}

/**
 * TypeScript type for request list item
 * Simplified view for list pages
 */
export interface RequestListItem {
  id: string;
  title: string | null;
  status: string;
  totalInvoices: number;
  processedCount: number;
  failedCount: number;
  totalAmount: number | null;
  currency: string | null;
  createdAt: Date;
  submittedAt: Date | null;
  defaultVendor?: {
    id: string;
    name: string;
  } | null;
}

/**
 * TypeScript type for request timeline
 * Used in timeline/activity feed components
 */
export interface RequestTimelineItem {
  id: string;
  timestamp: Date;
  eventType: string;
  summary: string;
  details?: any;
  userName: string | null;
}

/**
 * Type guard to check if a status is valid
 */
export function isValidRequestStatus(value: unknown): value is RequestStatusType {
  return Object.values(RequestStatus).includes(value as RequestStatusType);
}

/**
 * Helper to generate auto-generated request title
 * Format: "Batch YYYY-MM-DD HH:mm"
 */
export function generateAutoRequestTitle(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `Batch ${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Helper to calculate success rate
 */
export function calculateSuccessRate(processedCount: number, totalInvoices: number): number {
  if (totalInvoices === 0) return 0;
  return Math.round((processedCount / totalInvoices) * 100);
}

/**
 * Helper to format request status for display
 */
export function formatRequestStatus(status: string): string {
  switch (status) {
    case RequestStatus.DRAFT:
      return 'Draft';
    case RequestStatus.PROCESSING:
      return 'Processing';
    case RequestStatus.COMPLETED:
      return 'Completed';
    case RequestStatus.PARTIAL:
      return 'Partial';
    case RequestStatus.FAILED:
      return 'Failed';
    default:
      return status;
  }
}

/**
 * Helper to get status color for UI
 */
export function getRequestStatusColor(status: string): string {
  switch (status) {
    case RequestStatus.DRAFT:
      return 'gray';
    case RequestStatus.PROCESSING:
      return 'blue';
    case RequestStatus.COMPLETED:
      return 'green';
    case RequestStatus.PARTIAL:
      return 'yellow';
    case RequestStatus.FAILED:
      return 'red';
    default:
      return 'gray';
  }
}
