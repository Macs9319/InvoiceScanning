# Project Backlog

This document tracks planned features, enhancements, and technical improvements for the Invoice Scanner application.

---

## 🔴 High Priority - Production Readiness

### 1. Background Job Processing
**Current Issue**: Synchronous processing causes timeouts on large PDFs
**Impact**: High - affects user experience and reliability
**Effort**: Medium (2-3 days)
**Status**: Not Started

**Suggested Approach**:
- Implement job queue system (Bull/BullMQ with Redis) or serverless functions
- Add job status tracking in database
- Implement polling or WebSocket for real-time progress updates

**Files to Modify**:
- `src/app/api/process/route.ts` - Convert to job queue dispatch
- `src/components/InvoiceTable.tsx` - Add real-time status polling
- `src/lib/queue/` - New job queue implementation

---

### 2. Cloud Storage Integration
**Current Issue**: Local file storage in `public/uploads/` not production-ready
**Impact**: High - security and scalability concerns
**Effort**: Medium (2-3 days)
**Status**: Not Started

**Suggested Approach**:
- Migrate to AWS S3 or Azure Blob Storage
- Implement presigned URLs for secure file access
- Add file cleanup/lifecycle policies
- Update file URL handling throughout application

**Files to Modify**:
- `src/app/api/upload/route.ts` - Upload to cloud storage
- `src/lib/pdf/parser.ts` - Read from cloud storage
- `src/app/api/invoices/route.ts` - Delete from cloud storage
- Environment variables - Add cloud storage credentials

---

### 3. Database Migration to PostgreSQL/MySQL ✅
**Current Issue**: SQLite not suitable for concurrent writes in high-traffic scenarios
**Impact**: High - production scalability
**Effort**: Small (1 day)
**Status**: ✅ Completed (2025-12-30)

**Completed Changes**:
- ✅ Updated Prisma schema to use PostgreSQL as primary database
- ✅ Added @db.Text annotations for large text fields (optimal PostgreSQL performance)
- ✅ Updated CLAUDE.md with PostgreSQL configuration examples
- ✅ Created comprehensive MIGRATION_GUIDE.md for SQLite → PostgreSQL migration
- ✅ SQLite still supported for local development (switch provider in schema)

**Files Modified**:
- `prisma/schema.prisma` - Changed to PostgreSQL, added Text field types
- `CLAUDE.md` - Updated database documentation and environment variables
- `MIGRATION_GUIDE.md` - New comprehensive migration guide

---

## 🟡 Medium Priority - Feature Enhancements

### 4. GPT-4 Vision for Scanned Documents
**Current Issue**: Scanned/image-based PDFs fail to extract properly
**Impact**: Medium - improves extraction accuracy for difficult documents
**Effort**: Medium (2-3 days)
**Status**: Not Started

**Suggested Approach**:
- Implement fallback to GPT-4 Vision API when text extraction yields poor results
- Convert PDF pages to images
- Send images to GPT-4 Vision for extraction
- Add quality detection heuristics (low text density = scanned document)

**Files to Modify**:
- `src/lib/ai/extractor.ts` - Add Vision API integration
- `src/lib/pdf/parser.ts` - Add image conversion capabilities
- Add new dependencies: `pdf2pic` or similar

---

### 5. Additional OAuth Providers (Microsoft, Apple)
**Current Issue**: Only Google OAuth supported
**Impact**: Medium - broader user base
**Effort**: Small-Medium (1-2 days per provider)
**Status**: Not Started

**Suggested Approach**:
- Add Microsoft/Azure AD provider to NextAuth config
- Add Sign in with Apple provider
- Update login UI with new provider buttons
- Test account linking with existing email accounts

**Files to Modify**:
- `src/lib/auth.ts` - Add new providers
- `src/app/login/page.tsx` - Add provider buttons
- Environment variables - Add provider credentials

---

### 6. Invoice Templates & Vendor Management ✅
**Current Issue**: No vendor recognition or templates for common invoice formats
**Impact**: Medium - improves extraction accuracy and user experience
**Effort**: Large (5-7 days)
**Status**: ✅ Completed (2025-12-30)

**Completed Features**:
- ✅ Vendor database with identifiers (Tax ID, Company Registration, etc.)
- ✅ Three-strategy vendor detection (identifier matching, AI detection, fuzzy matching)
- ✅ Custom extraction templates per vendor with custom prompts
- ✅ Custom field definitions and field mappings
- ✅ Validation rules for vendor-specific requirements
- ✅ Bulk vendor assignment for invoices
- ✅ Template usage tracking (invoice count, last used timestamp)

**Files Created/Modified**:
- `prisma/schema.prisma` - Added Vendor and VendorTemplate models
- `src/app/api/vendors/` - Vendor CRUD endpoints
- `src/app/api/vendors/[vendorId]/templates/` - Template management endpoints
- `src/app/api/invoices/bulk-assign-vendor/route.ts` - Bulk vendor assignment
- `src/lib/ai/vendor-detector.ts` - Vendor detection logic
- `src/lib/ai/schema-builder.ts` - Dynamic schema generation
- `src/lib/ai/field-mapper.ts` - Field mapping and validation
- `src/components/vendors/` - Vendor management UI components
- `src/components/BulkVendorAssignment.tsx` - Bulk assignment UI

---

### 7. User Profile Page
**Current Issue**: No dedicated page for users to view and edit their profile information
**Impact**: Medium - improves user experience and account management
**Effort**: Small-Medium (2-3 days)
**Status**: Not Started

**Suggested Features**:
- Display user information (name, email, profile picture)
- Edit profile details (name, profile picture)
- View account creation date and last login
- Link/unlink OAuth providers (Google, Microsoft, Apple)
- Display email verification status
- Avatar upload and management
- Account statistics (total invoices processed, storage used, etc.)
- Delete account option with confirmation

**Files to Create**:
- `src/app/profile/page.tsx` - Profile page UI
- `src/app/api/profile/route.ts` - Profile update endpoint
- `src/app/api/profile/avatar/route.ts` - Avatar upload endpoint
- `src/components/ProfileForm.tsx` - Profile edit form component
- `src/components/AvatarUpload.tsx` - Avatar upload component
- `src/components/AccountStats.tsx` - Statistics display component

**Files to Modify**:
- `src/components/header.tsx` - Add link to profile page
- `prisma/schema.prisma` - Potentially add fields for avatar URL, lastLogin, etc.

---

### 8. Settings Page
**Current Issue**: No centralized settings page for application preferences and configurations
**Impact**: Medium - improves user control and customization
**Effort**: Medium (3-4 days)
**Status**: Not Started

**Suggested Features**:
- **Appearance Settings**:
  - Theme selection (light, dark, system)
  - Language/locale preferences
  - Date format preferences (MM/DD/YYYY vs DD/MM/YYYY)
  - Currency display preferences
- **Notification Settings**:
  - Email notifications for completed processing
  - Email notifications for failed processing
  - Weekly/monthly summary emails
  - Notification preferences (email, in-app)
- **Processing Settings**:
  - Default currency for new invoices
  - Auto-process on upload toggle
  - Default vendor assignment behavior
  - PDF retention policy (keep originals, delete after X days)
- **Export Settings**:
  - Default export format (Excel, CSV, JSON)
  - Export filename template
  - Include/exclude specific fields in exports
- **Security Settings**:
  - Two-factor authentication (2FA) setup
  - Active sessions management
  - API key generation (for future API access)
  - Password change
- **Data Management**:
  - Storage usage display
  - Bulk data cleanup options
  - Data export (full account data)
  - GDPR compliance tools

**Files to Create**:
- `src/app/settings/page.tsx` - Settings page UI with tabs
- `src/app/api/settings/route.ts` - Settings CRUD endpoints
- `src/app/api/settings/sessions/route.ts` - Session management endpoint
- `src/components/settings/AppearanceSettings.tsx` - Appearance tab component
- `src/components/settings/NotificationSettings.tsx` - Notifications tab component
- `src/components/settings/ProcessingSettings.tsx` - Processing tab component
- `src/components/settings/SecuritySettings.tsx` - Security tab component
- `src/components/settings/DataSettings.tsx` - Data management tab component
- `prisma/schema.prisma` - Add UserSettings model

**Files to Modify**:
- `src/components/header.tsx` - Add link to settings page
- `src/app/api/process/route.ts` - Respect auto-process and default currency settings
- `src/lib/export/` - Respect export format preferences

**Database Schema Addition**:
```prisma
model UserSettings {
  id                    String   @id @default(cuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Appearance
  theme                 String?  @default("system")
  locale                String?  @default("en")
  dateFormat            String?  @default("MM/DD/YYYY")

  // Notifications
  emailOnSuccess        Boolean  @default(false)
  emailOnFailure        Boolean  @default(true)
  weeklySummary         Boolean  @default(false)

  // Processing
  defaultCurrency       String?  @default("USD")
  autoProcessOnUpload   Boolean  @default(false)
  pdfRetentionDays      Int?     @default(365)

  // Export
  defaultExportFormat   String?  @default("excel")
  exportFilenameTemplate String? @default("{date}_{invoiceNumber}")

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

---

### 9. Custom AI Model Provider Selection
**Current Issue**: Hardcoded to use only OpenAI GPT-4o-mini model
**Impact**: Medium - provides flexibility, cost optimization, and performance tuning
**Effort**: Medium-Large (4-5 days)
**Status**: Not Started

**Suggested Features**:
- **Multiple OpenAI Models**:
  - GPT-4o-mini (current, cost-effective)
  - GPT-4o (balanced performance)
  - GPT-4 Turbo (highest accuracy)
  - GPT-3.5 Turbo (lowest cost)
- **Alternative AI Providers**:
  - Anthropic Claude (Claude 3.5 Sonnet, Claude 3 Opus)
  - Google Gemini (Gemini 1.5 Pro, Gemini 1.5 Flash)
  - Azure OpenAI Service
  - Local models (Ollama, LM Studio)
- **Configuration Options**:
  - Global default model setting (admin/user level)
  - Per-vendor model override (use GPT-4 for complex vendors)
  - Per-invoice manual model selection
  - Fallback model chain (try GPT-4o-mini, fallback to GPT-4 on failure)
  - Temperature and max tokens customization
- **Cost Tracking**:
  - Track token usage per model
  - Display cost per invoice
  - Monthly cost reports by model/provider
  - Budget alerts and limits
- **Model Comparison**:
  - A/B testing different models on same invoice
  - Accuracy metrics per model
  - Processing time comparison
  - Cost vs. accuracy analysis

**Database Schema Addition**:
```prisma
model AIModelConfig {
  id                  String   @id @default(cuid())
  userId              String?  // null = system default
  user                User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  vendorId            String?  // vendor-specific override
  vendor              Vendor?  @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  provider            String   // "openai", "anthropic", "google", "azure", "ollama"
  model               String   // "gpt-4o-mini", "claude-3-5-sonnet", etc.
  temperature         Float    @default(0.1)
  maxTokens           Int?
  fallbackProvider    String?
  fallbackModel       String?

  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([userId, vendorId])
  @@index([userId])
  @@index([vendorId])
}

model AIUsageLog {
  id                  String   @id @default(cuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  invoiceId           String
  invoice             Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  provider            String
  model               String
  promptTokens        Int
  completionTokens    Int
  totalTokens         Int
  estimatedCost       Float    // in USD
  processingTime      Int      // in milliseconds

  createdAt           DateTime @default(now())

  @@index([userId])
  @@index([invoiceId])
  @@index([createdAt])
}
```

**Files to Create**:
- `src/lib/ai/providers/` - Provider abstraction layer
  - `openai-provider.ts` - OpenAI implementation
  - `anthropic-provider.ts` - Anthropic Claude implementation
  - `google-provider.ts` - Google Gemini implementation
  - `azure-provider.ts` - Azure OpenAI implementation
  - `ollama-provider.ts` - Local Ollama implementation
  - `base-provider.ts` - Abstract base class/interface
- `src/lib/ai/model-selector.ts` - Model selection logic
- `src/lib/ai/cost-calculator.ts` - Token and cost tracking
- `src/app/api/ai-config/route.ts` - Model configuration CRUD
- `src/app/api/ai-usage/route.ts` - Usage analytics endpoint
- `src/components/settings/AIModelSettings.tsx` - Model selection UI
- `src/components/ModelSelector.tsx` - Dropdown for model selection
- `src/components/UsageAnalytics.tsx` - Cost and usage dashboard

**Files to Modify**:
- `src/lib/ai/extractor.ts` - Use provider abstraction instead of hardcoded OpenAI
- `src/app/api/process/route.ts` - Select model based on user/vendor config
- `src/app/settings/page.tsx` - Add AI Model Settings tab
- Environment variables - Add API keys for multiple providers

**Environment Variables to Add**:
```env
# OpenAI (existing)
OPENAI_API_KEY=sk-...

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
GOOGLE_AI_API_KEY=...

# Azure OpenAI
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_DEPLOYMENT=...

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434
```

**Implementation Phases**:
1. **Phase 1**: Create provider abstraction layer and interface
2. **Phase 2**: Implement OpenAI provider with multiple model support
3. **Phase 3**: Add alternative providers (Anthropic, Google)
4. **Phase 4**: Build configuration UI and model selector
5. **Phase 5**: Implement usage tracking and cost analytics

**Benefits**:
- Cost optimization (choose cheaper models for simple invoices)
- Performance tuning (use faster models when speed matters)
- Redundancy (fallback to alternative providers on outages)
- Future-proofing (easily add new models as they're released)
- Vendor lock-in mitigation (not dependent on single provider)

---

## 🟢 Low Priority - Nice to Have

### 10. Advanced Analytics Dashboard
**Impact**: Low-Medium - visualization and insights
**Effort**: Large (7-10 days)
**Status**: Not Started

**Suggested Approach**:
- Create analytics dashboard page
- Implement charts for spending trends over time
- Add category-based expense breakdown
- Show top vendors/categories
- Export analytics reports
- Use Charts.js or Recharts for visualizations

**Files to Create**:
- `src/app/analytics/page.tsx` - Dashboard page
- `src/app/api/analytics/route.ts` - Analytics data endpoint
- `src/components/AnalyticsCharts.tsx` - Chart components
- `src/lib/analytics/` - Analytics calculation utilities

---

### 11. Webhook Notifications
**Impact**: Low - integration capabilities
**Effort**: Medium (2-3 days)
**Status**: Not Started

**Suggested Approach**:
- Create webhook registration system
- Allow users to register webhook URLs
- Dispatch webhooks on invoice processing events (completed, failed)
- Implement retry logic for failed webhooks
- Add webhook signature verification

**Files to Create**:
- `src/app/api/webhooks/` - Webhook CRUD endpoints
- `src/lib/webhooks/dispatcher.ts` - Webhook dispatch logic
- `prisma/schema.prisma` - Add Webhook model
- `src/components/WebhookSettings.tsx` - Webhook management UI

---

### 12. API Documentation (Swagger/OpenAPI)
**Impact**: Low - developer experience
**Effort**: Small-Medium (1-2 days)
**Status**: Not Started

**Suggested Approach**:
- Add OpenAPI/Swagger annotations to all API routes
- Generate interactive API documentation
- Host documentation at `/api/docs`
- Include authentication examples
- Add request/response schemas

**Files to Modify**:
- All `src/app/api/**/route.ts` files - Add annotations
- Add swagger-ui-react or similar library
- Create documentation page

---

### 13. Mobile App Support
**Impact**: Low - mobile user base
**Effort**: Very Large (14+ days)
**Status**: Not Started

**Suggested Approach**:
- Phase 1: Improve responsive design and create PWA
- Phase 2: Consider React Native if native features needed
- Add offline support
- Optimize for mobile camera upload
- Add push notifications

**Files to Modify**:
- All component files - Improve mobile responsiveness
- Add PWA manifest and service worker
- Create mobile-optimized upload flow

---

## 📊 Recommended Work Order

### Phase 1 - Production Ready (1-2 weeks)
1. Background job processing
2. Cloud storage integration
3. ~~Database migration to PostgreSQL~~ ✅ **COMPLETED**

### Phase 2 - Enhanced Features (4-5 weeks)
4. GPT-4 Vision for scanned documents
5. Additional OAuth providers
6. ~~Invoice templates & vendor management~~ ✅ **COMPLETED**
7. User Profile Page
8. Settings Page
9. Custom AI Model Provider Selection

### Phase 3 - Advanced Features (3-4 weeks)
10. Advanced analytics dashboard
11. Webhook notifications
12. API documentation

### Phase 4 - Future (timeline flexible)
13. Mobile app support

---

## Known Limitations (Technical Debt)

From CLAUDE.md and codebase analysis:

1. **Scanned PDFs**: Text-based extraction only - GPT-4 Vision integration planned but not implemented
2. **Local File Storage**: Files stored in `public/uploads/` - not suitable for production (see #2 above)
3. **No Background Jobs**: Processing is synchronous - large PDFs may timeout (see #1 above)
4. **Hardcoded AI Model**: Only supports OpenAI GPT-4o-mini - no provider or model flexibility (see #9 above)
5. ~~**SQLite**: Not suitable for concurrent writes in high-traffic scenarios~~ ✅ **RESOLVED** - Migrated to PostgreSQL (2025-12-30)
6. ~~**No Vendor Management**: Manual categorization required~~ ✅ **RESOLVED** - Vendor templates & detection implemented (2025-12-30)

---

## Notes

- All effort estimates are approximate and may vary based on complexity discovered during implementation
- Priority levels can be adjusted based on user feedback and business requirements
- Each item should be broken down into smaller tasks when work begins
- Update status as work progresses: Not Started → In Progress → Completed

---

Last Updated: 2025-12-30 (Added Profile Page, Settings Page, and Custom AI Model Provider backlog items)
