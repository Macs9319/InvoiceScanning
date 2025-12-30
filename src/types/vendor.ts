import { z } from 'zod';

// ============================================================================
// Vendor Schemas
// ============================================================================

export const VendorCreateSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  description: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  address: z.string().optional(),
  identifiers: z.array(z.string()).optional(),
});

export const VendorUpdateSchema = VendorCreateSchema.partial();

export type VendorCreate = z.infer<typeof VendorCreateSchema>;
export type VendorUpdate = z.infer<typeof VendorUpdateSchema>;

// ============================================================================
// Custom Field Schemas
// ============================================================================

export const CustomFieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  type: z.enum(['string', 'number', 'boolean', 'date']),
  required: z.boolean().default(false),
  description: z.string().optional(),
});

export type CustomField = z.infer<typeof CustomFieldSchema>;

// ============================================================================
// Field Mapping Schemas
// ============================================================================

export const FieldMappingSchema = z.record(z.string(), z.string());

export type FieldMapping = z.infer<typeof FieldMappingSchema>;

// ============================================================================
// Validation Rule Schemas
// ============================================================================

export const ValidationRuleSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  rule: z.enum(['min', 'max', 'pattern', 'required', 'length']),
  value: z.union([z.string(), z.number()]),
  message: z.string().optional(),
});

export type ValidationRule = z.infer<typeof ValidationRuleSchema>;

// ============================================================================
// Template Schemas
// ============================================================================

export const TemplateCreateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  customPrompt: z.string().optional(),
  customFields: z.array(CustomFieldSchema).optional(),
  fieldMappings: FieldMappingSchema.optional(),
  validationRules: z.array(ValidationRuleSchema).optional(),
});

export const TemplateUpdateSchema = TemplateCreateSchema.partial();

export type TemplateCreate = z.infer<typeof TemplateCreateSchema>;
export type TemplateUpdate = z.infer<typeof TemplateUpdateSchema>;

// ============================================================================
// Vendor Detection
// ============================================================================

export interface VendorDetectionResult {
  vendorId: string | null;
  confidence: number; // 0-1
  detectedName?: string;
  matchReason: 'ai' | 'identifier' | 'fuzzy' | 'none';
}

// ============================================================================
// Bulk Operations
// ============================================================================

export const BulkAssignVendorSchema = z.object({
  invoiceIds: z.array(z.string()).min(1, 'At least one invoice ID is required'),
  vendorId: z.string().nullable(),
});

export type BulkAssignVendor = z.infer<typeof BulkAssignVendorSchema>;
