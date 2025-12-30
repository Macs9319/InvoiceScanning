import { z, ZodTypeAny } from 'zod';
import { ExtractedInvoiceSchema } from '@/types/invoice';
import { CustomField, ValidationRule } from '@/types/vendor';
import { VendorTemplate } from '@prisma/client';

/**
 * Build a dynamic Zod schema that extends the base invoice schema
 * with custom fields from the vendor template
 */
export function buildDynamicSchema(template?: VendorTemplate | null): z.ZodType<any> {
  let schema: z.ZodType<any> = ExtractedInvoiceSchema;

  if (!template || !template.customFields) {
    return schema;
  }

  try {
    const customFields = JSON.parse(template.customFields) as CustomField[];

    if (customFields.length === 0) {
      return schema;
    }

    // Build custom fields schema
    const customFieldsSchema: Record<string, ZodTypeAny> = {};

    customFields.forEach((field) => {
      let fieldSchema: ZodTypeAny;

      switch (field.type) {
        case 'string':
          fieldSchema = z.string();
          break;
        case 'number':
          fieldSchema = z.number();
          break;
        case 'boolean':
          fieldSchema = z.boolean();
          break;
        case 'date':
          fieldSchema = z.string(); // ISO date string
          break;
        default:
          fieldSchema = z.unknown();
      }

      // Make field optional/nullable if not required
      if (!field.required) {
        fieldSchema = fieldSchema.nullable().optional();
      }

      customFieldsSchema[field.name] = fieldSchema;
    });

    // Extend base schema with custom fields
    if (Object.keys(customFieldsSchema).length > 0) {
      schema = schema.extend(customFieldsSchema);
    }

    return schema;
  } catch (error) {
    console.error('Error building dynamic schema:', error);
    return ExtractedInvoiceSchema;
  }
}

/**
 * Apply validation rules to extracted data
 */
export function applyValidationRules(
  data: any,
  validationRules?: string | null
): { valid: boolean; errors: string[] } {
  if (!validationRules) {
    return { valid: true, errors: [] };
  }

  try {
    const rules = JSON.parse(validationRules) as ValidationRule[];
    const errors: string[] = [];

    rules.forEach((rule) => {
      const value = data[rule.field];

      switch (rule.rule) {
        case 'min':
          if (typeof value === 'number' && value < Number(rule.value)) {
            errors.push(
              rule.message ||
                `${rule.field} must be at least ${rule.value}`
            );
          }
          break;

        case 'max':
          if (typeof value === 'number' && value > Number(rule.value)) {
            errors.push(
              rule.message ||
                `${rule.field} must be at most ${rule.value}`
            );
          }
          break;

        case 'pattern':
          if (typeof value === 'string') {
            const regex = new RegExp(rule.value as string);
            if (!regex.test(value)) {
              errors.push(
                rule.message ||
                  `${rule.field} must match pattern ${rule.value}`
              );
            }
          }
          break;

        case 'required':
          if (!value || value === '' || value === null) {
            errors.push(
              rule.message || `${rule.field} is required`
            );
          }
          break;

        case 'length':
          if (typeof value === 'string') {
            const expectedLength = Number(rule.value);
            if (value.length !== expectedLength) {
              errors.push(
                rule.message ||
                  `${rule.field} must be exactly ${expectedLength} characters`
              );
            }
          }
          break;

        default:
          console.warn(`Unknown validation rule: ${rule.rule}`);
      }
    });

    return { valid: errors.length === 0, errors };
  } catch (error) {
    console.error('Error applying validation rules:', error);
    return { valid: true, errors: [] };
  }
}

/**
 * Get custom field definitions from template for prompt generation
 */
export function getCustomFieldDefinitions(template?: VendorTemplate | null): CustomField[] {
  if (!template || !template.customFields) {
    return [];
  }

  try {
    return JSON.parse(template.customFields) as CustomField[];
  } catch (error) {
    console.error('Error parsing custom fields:', error);
    return [];
  }
}
