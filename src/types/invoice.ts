import { z } from "zod";

// Zod schemas for validation
export const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  amount: z.number().nullable().optional(),
});

export const ExtractedInvoiceSchema = z.object({
  invoiceNumber: z.string().nullable().optional(),
  date: z.string().nullable().optional(), // ISO date string YYYY-MM-DD
  totalAmount: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  lineItems: z.array(LineItemSchema).default([]),
});

// TypeScript types derived from Zod schemas
export type LineItemData = z.infer<typeof LineItemSchema>;
export type ExtractedInvoiceData = z.infer<typeof ExtractedInvoiceSchema>;

// Invoice status types
export type InvoiceStatus =
  | "pending"
  | "queued"            // NEW: Job queued in background queue
  | "processing"
  | "processed"
  | "validation_failed" // NEW: Processed but validation rules failed
  | "failed";

// Extended types for frontend display
export interface InvoiceWithLineItems {
  id: string;
  fileName: string;
  fileUrl: string | null;
  invoiceNumber: string | null;
  date: Date | null;
  totalAmount: number | null;
  currency: string | null;
  status: string;
  rawText: string | null;
  aiResponse: string | null;
  createdAt: Date;
  updatedAt: Date;
  vendorId: string | null;
  vendor?: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  lineItems: {
    id: string;
    description: string;
    quantity: number | null;
    unitPrice: number | null;
    amount: number | null;
    order: number;
  }[];
}

// API Response types
export interface ProcessInvoiceResponse {
  success: boolean;
  invoiceId?: string;
  error?: string;
  extractedData?: ExtractedInvoiceData;
}

export interface UploadResponse {
  success: boolean;
  fileId?: string;
  fileName?: string;
  error?: string;
}

export interface ExportOptions {
  format: "excel" | "csv" | "json";
  invoiceIds?: string[]; // If not provided, export all
}
