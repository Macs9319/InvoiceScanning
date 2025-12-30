/**
 * Backend Testing Script for Vendor Management
 *
 * This script tests the vendor and template API endpoints
 * Run with: node test-vendor-backend.js
 *
 * Prerequisites:
 * - Dev server running on http://localhost:3000
 * - Valid authentication session (you'll need to log in first)
 */

const BASE_URL = 'http://localhost:3000';

// You'll need to replace this with a valid session cookie
// To get it: Log into the app, open DevTools > Application > Cookies > Copy the session cookie
const SESSION_COOKIE = 'YOUR_SESSION_COOKIE_HERE';

async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': SESSION_COOKIE,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function testVendorBackend() {
  console.log('🧪 Testing Vendor Management Backend\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Create a vendor
    console.log('\n📝 Test 1: Creating a vendor...');
    const createVendorResult = await makeRequest('/api/vendors', {
      method: 'POST',
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
    });

    if (createVendorResult.status === 201) {
      console.log('✅ Vendor created successfully!');
      console.log(`   Vendor ID: ${createVendorResult.data.vendor.id}`);
      const vendorId = createVendorResult.data.vendor.id;

      // Test 2: Get vendor details
      console.log('\n📝 Test 2: Fetching vendor details...');
      const getVendorResult = await makeRequest(`/api/vendors/${vendorId}`);

      if (getVendorResult.status === 200) {
        console.log('✅ Vendor fetched successfully!');
        console.log(`   Name: ${getVendorResult.data.vendor.name}`);
        console.log(`   Email: ${getVendorResult.data.vendor.email}`);
      } else {
        console.log('❌ Failed to fetch vendor');
        console.log(getVendorResult.data);
      }

      // Test 3: Create a template
      console.log('\n📝 Test 3: Creating a template...');
      const createTemplateResult = await makeRequest(
        `/api/vendors/${vendorId}/templates`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Acme Standard Invoice Template',
            description: 'Template for standard Acme invoices',
            isActive: true,
            customPrompt: `This vendor uses "Order Number" instead of "Invoice Number".
The total is always labeled as "Amount Due".
Tax ID should be extracted from the header.`,
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
              },
              {
                name: 'paymentTerms',
                type: 'string',
                required: false,
                description: 'Payment terms (e.g., Net 30)'
              }
            ],
            fieldMappings: {
              'orderNumber': 'invoiceNumber',
              'amountDue': 'totalAmount'
            },
            validationRules: [
              {
                field: 'totalAmount',
                rule: 'min',
                value: 0,
                message: 'Total amount must be positive'
              },
              {
                field: 'orderNumber',
                rule: 'required',
                message: 'Order number is required for Acme invoices'
              }
            ]
          })
        }
      );

      if (createTemplateResult.status === 201) {
        console.log('✅ Template created successfully!');
        console.log(`   Template ID: ${createTemplateResult.data.template.id}`);
        console.log(`   Active: ${createTemplateResult.data.template.isActive}`);

        const templateId = createTemplateResult.data.template.id;

        // Test 4: Get template details
        console.log('\n📝 Test 4: Fetching template details...');
        const getTemplateResult = await makeRequest(
          `/api/vendors/${vendorId}/templates/${templateId}`
        );

        if (getTemplateResult.status === 200) {
          console.log('✅ Template fetched successfully!');
          const template = getTemplateResult.data.template;
          console.log(`   Name: ${template.name}`);
          console.log(`   Custom Fields: ${template.customFields ? JSON.parse(template.customFields).length : 0} fields`);
          console.log(`   Field Mappings: ${template.fieldMappings ? Object.keys(JSON.parse(template.fieldMappings)).length : 0} mappings`);
          console.log(`   Validation Rules: ${template.validationRules ? JSON.parse(template.validationRules).length : 0} rules`);
        } else {
          console.log('❌ Failed to fetch template');
          console.log(getTemplateResult.data);
        }

        // Test 5: Update template
        console.log('\n📝 Test 5: Updating template...');
        const updateTemplateResult = await makeRequest(
          `/api/vendors/${vendorId}/templates/${templateId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              description: 'Updated template description'
            })
          }
        );

        if (updateTemplateResult.status === 200) {
          console.log('✅ Template updated successfully!');
        } else {
          console.log('❌ Failed to update template');
          console.log(updateTemplateResult.data);
        }

      } else {
        console.log('❌ Failed to create template');
        console.log(createTemplateResult.data);
      }

      // Test 6: List all vendors
      console.log('\n📝 Test 6: Listing all vendors...');
      const listVendorsResult = await makeRequest('/api/vendors');

      if (listVendorsResult.status === 200) {
        console.log('✅ Vendors listed successfully!');
        console.log(`   Total vendors: ${listVendorsResult.data.count}`);
        listVendorsResult.data.vendors.forEach((v, i) => {
          console.log(`   ${i + 1}. ${v.name} (${v._count.templates} templates, ${v._count.invoices} invoices)`);
        });
      } else {
        console.log('❌ Failed to list vendors');
        console.log(listVendorsResult.data);
      }

      // Test 7: List templates for vendor
      console.log('\n📝 Test 7: Listing templates for vendor...');
      const listTemplatesResult = await makeRequest(
        `/api/vendors/${vendorId}/templates`
      );

      if (listTemplatesResult.status === 200) {
        console.log('✅ Templates listed successfully!');
        console.log(`   Total templates: ${listTemplatesResult.data.templates.length}`);
        listTemplatesResult.data.templates.forEach((t, i) => {
          console.log(`   ${i + 1}. ${t.name} (${t.isActive ? 'Active' : 'Inactive'})`);
        });
      } else {
        console.log('❌ Failed to list templates');
        console.log(listTemplatesResult.data);
      }

    } else {
      console.log('❌ Failed to create vendor');
      console.log(createVendorResult.data);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Backend testing complete!\n');
    console.log('Next steps:');
    console.log('1. Upload a test invoice PDF through the UI');
    console.log('2. Process it and check if vendor auto-detection works');
    console.log('3. Verify custom fields are extracted');
    console.log('4. Check validation rules are applied\n');

  } catch (error) {
    console.error('\n❌ Error during testing:', error.message);
    console.error(error.stack);
  }
}

// Check if session cookie is set
if (SESSION_COOKIE === 'YOUR_SESSION_COOKIE_HERE') {
  console.log('⚠️  Please set your SESSION_COOKIE in the script first!\n');
  console.log('To get your session cookie:');
  console.log('1. Start the dev server: npm run dev');
  console.log('2. Log into the app at http://localhost:3000');
  console.log('3. Open DevTools > Application > Cookies');
  console.log('4. Copy the session cookie value');
  console.log('5. Replace SESSION_COOKIE in this script');
  console.log('6. Run: node test-vendor-backend.js\n');
  process.exit(1);
}

testVendorBackend();
