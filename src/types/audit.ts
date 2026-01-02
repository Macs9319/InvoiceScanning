import { z } from 'zod';

/**
 * Zod schema for audit log query parameters
 * Used for filtering and paginating audit logs in API endpoints
 */
export const AuditLogQuerySchema = z.object({
  // Filtering
  requestId: z.string().optional(),
  userId: z.string().optional(),
  eventType: z.string().optional(),
  eventCategory: z.string().optional(),
  severity: z.enum(['info', 'warning', 'error']).optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),

  // Date range filtering
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),

  // Pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),

  // Sorting
  sortBy: z.enum(['createdAt', 'eventType', 'severity']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

/**
 * Zod schema for audit log export parameters
 */
export const AuditLogExportSchema = z.object({
  format: z.enum(['csv', 'json']),
  requestId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  eventCategories: z.array(z.string()).optional(),
});

export type AuditLogExport = z.infer<typeof AuditLogExportSchema>;

/**
 * TypeScript type for audit log record (matches Prisma model)
 */
export interface AuditLogRecord {
  id: string;
  requestId: string | null;
  userId: string;
  eventType: string;
  eventCategory: string;
  severity: 'info' | 'warning' | 'error';
  summary: string;
  details: string | null;
  targetType: string | null;
  targetId: string | null;
  previousValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: string | null;
  createdAt: Date;
}

/**
 * TypeScript type for audit log with parsed JSON fields
 * Used in API responses after parsing JSON strings
 */
export interface ParsedAuditLog extends Omit<AuditLogRecord, 'details' | 'previousValue' | 'newValue' | 'metadata'> {
  details: any | null;
  previousValue: any | null;
  newValue: any | null;
  metadata: any | null;
}

/**
 * TypeScript type for audit log with related data
 * Used in detail views with user and request information
 */
export interface AuditLogWithRelations extends AuditLogRecord {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  request?: {
    id: string;
    title: string | null;
    status: string;
  } | null;
}

/**
 * TypeScript type for audit timeline event
 * Simplified view for timeline components
 */
export interface AuditTimelineEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  eventCategory: string;
  severity: 'info' | 'warning' | 'error';
  summary: string;
  details?: any;
  userName: string | null;
  userEmail: string;
  targetType: string | null;
  targetId: string | null;
}

/**
 * TypeScript type for audit statistics
 * Used in analytics dashboards
 */
export interface AuditStatistics {
  totalEvents: number;
  eventsByCategory: {
    category: string;
    count: number;
  }[];
  eventsBySeverity: {
    severity: 'info' | 'warning' | 'error';
    count: number;
  }[];
  eventsByType: {
    eventType: string;
    count: number;
  }[];
  recentEvents: ParsedAuditLog[];
}

/**
 * Type guard to check if an object is a valid severity level
 */
export function isValidSeverity(value: unknown): value is 'info' | 'warning' | 'error' {
  return value === 'info' || value === 'warning' || value === 'error';
}

/**
 * Helper to parse JSON fields from audit log
 * Safely parses JSON strings, returns null if invalid
 */
export function parseAuditLogJson(log: AuditLogRecord): ParsedAuditLog {
  const parseJsonField = (field: string | null): any | null => {
    if (!field) return null;
    try {
      return JSON.parse(field);
    } catch {
      return null;
    }
  };

  return {
    ...log,
    details: parseJsonField(log.details),
    previousValue: parseJsonField(log.previousValue),
    newValue: parseJsonField(log.newValue),
    metadata: parseJsonField(log.metadata),
  };
}

/**
 * Helper to format audit log for timeline display
 */
export function formatForTimeline(log: AuditLogWithRelations): AuditTimelineEvent {
  return {
    id: log.id,
    timestamp: log.createdAt,
    eventType: log.eventType,
    eventCategory: log.eventCategory,
    severity: log.severity,
    summary: log.summary,
    details: log.details ? JSON.parse(log.details) : undefined,
    userName: log.user.name,
    userEmail: log.user.email,
    targetType: log.targetType,
    targetId: log.targetId,
  };
}
