import { FieldMapping } from '@/types/vendor';

/**
 * Apply field mappings to extracted data
 * Maps vendor-specific field names to standard field names
 *
 * Example:
 * Input: { "orderNumber": "12345", "totalDue": 100 }
 * Mappings: { "orderNumber": "invoiceNumber", "totalDue": "totalAmount" }
 * Output: { "invoiceNumber": "12345", "totalAmount": 100, "orderNumber": "12345", "totalDue": 100 }
 */
export function applyFieldMappings(
  extractedData: any,
  fieldMappings?: string | null
): any {
  if (!fieldMappings) {
    return extractedData;
  }

  try {
    const mappings = JSON.parse(fieldMappings) as FieldMapping;
    const mappedData = { ...extractedData };

    // Apply mappings: vendor field -> standard field
    Object.entries(mappings).forEach(([vendorField, standardField]) => {
      if (extractedData[vendorField] !== undefined) {
        // Copy vendor field value to standard field
        mappedData[standardField] = extractedData[vendorField];

        // Keep the original vendor field as well (it will go to customData)
        // This preserves the original extraction for audit purposes
      }
    });

    return mappedData;
  } catch (error) {
    console.error('Error applying field mappings:', error);
    return extractedData;
  }
}

/**
 * Separate standard invoice fields from custom vendor-specific fields
 * Returns an object with standardFields and customFields
 */
export function separateStandardAndCustomFields(data: any): {
  standardFields: {
    invoiceNumber?: string | null;
    date?: string | null;
    totalAmount?: number | null;
    currency?: string | null;
    lineItems?: any[];
  };
  customFields: Record<string, any>;
} {
  const standardFieldNames = [
    'invoiceNumber',
    'date',
    'totalAmount',
    'currency',
    'lineItems',
  ];

  const standardFields: any = {};
  const customFields: Record<string, any> = {};

  Object.entries(data).forEach(([key, value]) => {
    if (standardFieldNames.includes(key)) {
      standardFields[key] = value;
    } else {
      customFields[key] = value;
    }
  });

  return { standardFields, customFields };
}
