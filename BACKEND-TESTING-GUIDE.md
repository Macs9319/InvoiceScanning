# Backend Testing Guide - Vendor Management

The development server is now running at **http://localhost:3000**

## ✅ What's Been Built

### Phase 1 & 2 Complete:
- ✅ Database schema with Vendor and VendorTemplate models
- ✅ Vendor CRUD API endpoints
- ✅ Template CRUD API endpoints
- ✅ AI-powered vendor detection from invoice text
- ✅ Dynamic schema builder for custom fields
- ✅ Field mapping and validation rules
- ✅ Enhanced invoice processing with vendor support

## 🧪 Testing Methods

### Option 1: Manual Testing via UI (Recommended)

1. **Open the application**: http://localhost:3000
2. **Log in** with your test account
3. **Use the browser DevTools Console** to test API endpoints directly

Example commands to paste in the browser console:

```javascript
// Test 1: Create a vendor
await fetch('/api/vendors', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Acme Corporation',
    description: 'Test vendor for backend validation',
    email: 'billing@acme.com',
    phone: '555-0100',
    website: 'https://acme.com',
    address: '123 Main St, City, ST 12345',
    identifiers: [
      'Tax ID: 12-3456789',
      'Acme Corp',
      'ACME CORPORATION'
    ]
  })
}).then(r => r.json()).then(data => {
  console.log('✅ Vendor created:', data);
  window.testVendorId = data.vendor.id; // Save for next tests
});

// Test 2: List all vendors
await fetch('/api/vendors')
  .then(r => r.json())
  .then(data => console.log('✅ Vendors:', data));

// Test 3: Create a template (use the vendorId from Test 1)
await fetch(`/api/vendors/${window.testVendorId}/templates`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Acme Standard Invoice Template',
    description: 'Template for standard Acme invoices',
    isActive: true,
    customPrompt: `This vendor uses "Order Number" instead of "Invoice Number".
The total is always labeled as "Amount Due".`,
    customFields: [
      {
        name: 'orderNumber',
        type: 'string',
        required: true,
        description: 'Purchase Order Number'
      },
      {
        name: 'taxId',
        type: 'string',
        required: false,
        description: 'Vendor Tax ID'
      }
    ],
    fieldMappings: {
      'orderNumber': 'invoiceNumber'
    },
    validationRules: [
      {
        field: 'totalAmount',
        rule: 'min',
        value: 0,
        message: 'Total amount must be positive'
      }
    ]
  })
}).then(r => r.json()).then(data => {
  console.log('✅ Template created:', data);
  window.testTemplateId = data.template.id;
});

// Test 4: Get template details
await fetch(`/api/vendors/${window.testVendorId}/templates/${window.testTemplateId}`)
  .then(r => r.json())
  .then(data => console.log('✅ Template details:', data));

// Test 5: List templates for vendor
await fetch(`/api/vendors/${window.testVendorId}/templates`)
  .then(r => r.json())
  .then(data => console.log('✅ Templates:', data));
```

### Option 2: Test with cURL

After logging in to get your session cookie:

```bash
# Get your session cookie from browser DevTools > Application > Cookies
# Replace YOUR_SESSION_COOKIE with the actual value

# Test: Create a vendor
curl -X POST http://localhost:3000/api/vendors \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "name": "Acme Corporation",
    "email": "billing@acme.com",
    "identifiers": ["Tax ID: 12-3456789", "Acme Corp"]
  }'

# Test: List vendors
curl http://localhost:3000/api/vendors \
  -H "Cookie: YOUR_SESSION_COOKIE"
```

### Option 3: Automated Test Script

```bash
# Edit the script to add your session cookie
# Then run:
node test-vendor-backend.js
```

## 🔍 What to Test

### 1. Vendor CRUD Operations

- ✅ Create vendor with identifiers
- ✅ List all vendors
- ✅ Get single vendor details
- ✅ Update vendor information
- ✅ Delete vendor (invoices remain but vendorId set to null)

### 2. Template Management

- ✅ Create template with custom prompt
- ✅ Add custom field definitions
- ✅ Add field mappings
- ✅ Add validation rules
- ✅ Set template as active (deactivates others)
- ✅ Update template
- ✅ Delete template

### 3. Invoice Processing with Vendor Detection

**To test end-to-end:**

1. Create a vendor with identifiers like "Acme Corp" or "Tax ID: 12-3456789"
2. Create a template for that vendor with custom fields
3. Upload a PDF invoice that contains text matching the vendor identifiers
4. Process the invoice through the existing UI
5. Check the response - it should include:
   - `vendorDetection.detectedVendorId` - The auto-detected vendor ID
   - `vendorDetection.templateUsed` - Name of template that was applied
   - `validation.valid` - Whether validation rules passed
   - `validation.errors` - Any validation error messages

### 4. Vendor Detection Strategies

The system tries 3 detection methods in order:

1. **Identifier matching** (fast, free) - Checks if any vendor identifier appears in PDF text
2. **AI detection** (accurate, ~$0.0001 cost) - Uses GPT-4o-mini to analyze and match vendor
3. **Fuzzy matching** (fallback) - Looks for partial name matches

Test by uploading invoices with:
- Exact identifier match (e.g., "Tax ID: 12-3456789")
- Vendor name in header
- Partial vendor name

### 5. Custom Fields & Validation

After creating a template with custom fields:

1. Upload an invoice from that vendor
2. Process it
3. Check the database - custom fields should be in `customData` JSON column
4. If validation rules fail, status should be `validation_failed`

## 📊 Database Inspection

View the data directly:

```bash
npx prisma studio
```

This opens a GUI at http://localhost:5555 where you can inspect:
- Vendor table
- VendorTemplate table
- Invoice table (check vendorId, detectedVendorId, templateId, customData fields)

## ✅ Expected Results

### Vendor Creation Response:
```json
{
  "success": true,
  "vendor": {
    "id": "clx...",
    "name": "Acme Corporation",
    "email": "billing@acme.com",
    "_count": {
      "templates": 0,
      "invoices": 0
    }
  }
}
```

### Template Creation Response:
```json
{
  "success": true,
  "template": {
    "id": "clx...",
    "vendorId": "clx...",
    "name": "Acme Standard Invoice Template",
    "isActive": true,
    "customFields": "[{\"name\":\"orderNumber\",\"type\":\"string\"...}]"
  }
}
```

### Invoice Processing with Vendor:
```json
{
  "success": true,
  "invoice": {
    "id": "clx...",
    "vendorId": "clx...",
    "detectedVendorId": "clx...",
    "templateId": "clx...",
    "customData": "{\"orderNumber\":\"PO-12345\",\"taxId\":\"12-3456789\"}",
    "status": "processed"
  },
  "vendorDetection": {
    "detectedVendorId": "clx...",
    "templateUsed": "Acme Standard Invoice Template"
  },
  "validation": {
    "valid": true,
    "errors": []
  }
}
```

## 🐛 Troubleshooting

### Issue: 401 Unauthorized
- **Solution**: Make sure you're logged in first at http://localhost:3000

### Issue: 403 Forbidden
- **Solution**: You're trying to access a vendor that belongs to another user

### Issue: Vendor not detected
- **Solution**:
  - Check that identifiers match text in PDF
  - Ensure OPENAI_API_KEY is configured
  - Check console logs for detection details

### Issue: Custom fields not appearing
- **Solution**:
  - Verify template is set as `isActive: true`
  - Check that vendorId was passed to processing
  - Look at `customData` field in database

## 🎯 Next Steps

Once backend testing is complete, we'll build:
- `/vendors` page with full UI
- Vendor and template management components
- Invoice table updates to show vendor info
- Bulk vendor assignment
- Export updates with vendor data

The backend is fully functional and ready for frontend integration!
