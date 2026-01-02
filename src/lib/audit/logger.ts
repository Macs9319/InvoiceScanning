import { prisma } from "@/lib/db/prisma";

export interface AuditEventInput {
  requestId?: string;
  userId: string;
  eventType: string;
  eventCategory: string;
  severity?: 'info' | 'warning' | 'error';
  summary: string;
  details?: any;  // Will be JSON.stringify'd
  targetType?: string;
  targetId?: string;
  previousValue?: any;  // Will be JSON.stringify'd
  newValue?: any;  // Will be JSON.stringify'd
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;  // Will be JSON.stringify'd
}

/**
 * Log a single audit event to the database
 *
 * @param event - The audit event data
 * @returns Promise that resolves when the event is logged
 *
 * @example
 * ```typescript
 * await logAuditEvent({
 *   userId: session.user.id,
 *   eventType: 'invoice_uploaded',
 *   eventCategory: 'invoice_operation',
 *   summary: `Invoice ${fileName} uploaded`,
 *   targetType: 'invoice',
 *   targetId: invoice.id,
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...',
 * });
 * ```
 */
export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        requestId: event.requestId,
        userId: event.userId,
        eventType: event.eventType,
        eventCategory: event.eventCategory,
        severity: event.severity || 'info',
        summary: event.summary,
        details: event.details ? JSON.stringify(event.details) : null,
        targetType: event.targetType,
        targetId: event.targetId,
        previousValue: event.previousValue ? JSON.stringify(event.previousValue) : null,
        newValue: event.newValue ? JSON.stringify(event.newValue) : null,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      },
    });
  } catch (error) {
    // Log errors but don't throw - audit logging should not break primary operations
    console.error('Failed to log audit event:', error);
    console.error('Event data:', event);
  }
}

/**
 * Log multiple audit events in a single transaction
 * Useful for bulk operations that affect multiple resources
 *
 * @param events - Array of audit event data
 * @returns Promise that resolves when all events are logged
 *
 * @example
 * ```typescript
 * await logBulkAuditEvents([
 *   { userId, eventType: 'invoice_deleted', summary: 'Invoice 1 deleted', ... },
 *   { userId, eventType: 'invoice_deleted', summary: 'Invoice 2 deleted', ... },
 * ]);
 * ```
 */
export async function logBulkAuditEvents(events: AuditEventInput[]): Promise<void> {
  if (events.length === 0) return;

  try {
    await prisma.auditLog.createMany({
      data: events.map(event => ({
        requestId: event.requestId,
        userId: event.userId,
        eventType: event.eventType,
        eventCategory: event.eventCategory,
        severity: event.severity || 'info',
        summary: event.summary,
        details: event.details ? JSON.stringify(event.details) : null,
        targetType: event.targetType,
        targetId: event.targetId,
        previousValue: event.previousValue ? JSON.stringify(event.previousValue) : null,
        newValue: event.newValue ? JSON.stringify(event.newValue) : null,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      })),
    });
  } catch (error) {
    console.error('Failed to log bulk audit events:', error);
    console.error('Events count:', events.length);
  }
}

/**
 * Helper to log audit event within a Prisma transaction
 * Use this when you need atomic operations (e.g., delete resource + log event)
 *
 * @param tx - Prisma transaction client
 * @param event - The audit event data
 * @returns Promise that resolves when the event is logged
 *
 * @example
 * ```typescript
 * await prisma.$transaction(async (tx) => {
 *   await tx.invoice.delete({ where: { id } });
 *   await logAuditEventInTransaction(tx, {
 *     userId,
 *     eventType: 'invoice_deleted',
 *     summary: 'Invoice deleted',
 *     targetId: id,
 *   });
 * });
 * ```
 */
export async function logAuditEventInTransaction(
  tx: any,  // Prisma transaction client type
  event: AuditEventInput
): Promise<void> {
  await tx.auditLog.create({
    data: {
      requestId: event.requestId,
      userId: event.userId,
      eventType: event.eventType,
      eventCategory: event.eventCategory,
      severity: event.severity || 'info',
      summary: event.summary,
      details: event.details ? JSON.stringify(event.details) : null,
      targetType: event.targetType,
      targetId: event.targetId,
      previousValue: event.previousValue ? JSON.stringify(event.previousValue) : null,
      newValue: event.newValue ? JSON.stringify(event.newValue) : null,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    },
  });
}

/**
 * Event type constants for consistency across the app
 */
export const AuditEventTypes = {
  // Request lifecycle events
  REQUEST_CREATED: 'request_created',
  REQUEST_UPDATED: 'request_updated',
  REQUEST_SUBMITTED: 'request_submitted',
  REQUEST_COMPLETED: 'request_completed',
  REQUEST_DELETED: 'request_deleted',

  // Invoice operation events
  INVOICE_UPLOADED: 'invoice_uploaded',
  INVOICE_ADDED_TO_REQUEST: 'invoice_added_to_request',
  INVOICE_REMOVED_FROM_REQUEST: 'invoice_removed_from_request',
  INVOICE_PROCESSING_STARTED: 'invoice_processing_started',
  INVOICE_PROCESSING_COMPLETED: 'invoice_processing_completed',
  INVOICE_PROCESSING_FAILED: 'invoice_processing_failed',
  INVOICE_DELETED: 'invoice_deleted',
  INVOICE_RETRIED: 'invoice_retried',

  // Vendor operation events
  VENDOR_ASSIGNED: 'vendor_assigned',
  VENDOR_UNASSIGNED: 'vendor_unassigned',
  VENDOR_DETECTED: 'vendor_detected',

  // User action events
  BULK_DELETE: 'bulk_delete',
  BULK_EXPORT: 'bulk_export',
  BULK_RETRY: 'bulk_retry',
  BULK_VENDOR_ASSIGNMENT: 'bulk_vendor_assignment',
} as const;

/**
 * Event category constants for organizing audit logs
 */
export const AuditEventCategories = {
  REQUEST_LIFECYCLE: 'request_lifecycle',
  INVOICE_OPERATION: 'invoice_operation',
  VENDOR_OPERATION: 'vendor_operation',
  USER_ACTION: 'user_action',
} as const;
