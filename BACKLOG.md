# Project Backlog

This document tracks planned features, enhancements, and technical improvements for the Invoice Scanner application.

---

## 🔴 High Priority - Production Readiness

### 1. Background Job Processing ✅
**Current Issue**: Synchronous processing causes timeouts on large PDFs
**Impact**: High - affects user experience and reliability
**Effort**: Medium (2-3 days)
**Status**: ✅ Completed (2026-01-02)

**Completed Features**:
- ✅ BullMQ job queue with Redis for asynchronous processing
- ✅ Dedicated worker process with configurable concurrency (5 jobs)
- ✅ Real-time status polling via frontend hook (every 10-20 seconds)
- ✅ Job tracking fields in database (jobId, processingStartedAt, retryCount, lastError)
- ✅ Enhanced status badges (queued, processing, validation_failed)
- ✅ Automatic retry with exponential backoff (3 attempts)
- ✅ Three operational modes: separate worker, embedded, or synchronous fallback
- ✅ Graceful degradation when Redis unavailable
- ✅ Support for serverless (Vercel + Upstash) and self-hosted deployments
- ✅ Lazy-loaded OpenAI client for worker compatibility

**Files Created**:
- `src/lib/queue/redis-client.ts` - Redis connection singleton
- `src/lib/queue/invoice-queue.ts` - BullMQ queue manager
- `src/workers/invoice-processor.ts` - Worker process
- `src/workers/processor-logic.ts` - Core processing logic
- `src/app/api/process/legacy-processor.ts` - Synchronous fallback
- `src/app/api/invoices/status/route.ts` - Status polling API
- `src/hooks/useInvoicePolling.ts` - Frontend polling hook
- `src/types/queue.ts` - Queue type definitions
- `tsconfig.worker.json` - Worker TypeScript config

**Files Modified**:
- `src/app/api/process/route.ts` - Job dispatcher with fallback
- `src/app/page.tsx` - Polling integration with auto-refresh
- `src/components/InvoiceTable.tsx` - Enhanced status badges
- `src/lib/ai/extractor.ts` - Lazy-loaded OpenAI client
- `src/lib/ai/vendor-detector.ts` - Lazy-loaded OpenAI client
- `src/types/invoice.ts` - Added queued/validation_failed statuses
- `prisma/schema.prisma` - Added job tracking fields
- `package.json` - Added BullMQ, ioredis, worker scripts

---

### 2. Cloud Storage Integration ✅
**Current Issue**: Local file storage in `public/uploads/` not production-ready
**Impact**: High - security and scalability concerns
**Effort**: Medium (2-3 days)
**Status**: ✅ Completed (2025-12-31)

**Completed Features**:
- ✅ AWS S3 integration with presigned URLs for secure downloads
- ✅ Hybrid storage support (both local and S3 files work transparently)
- ✅ User isolation with S3 key structure: `users/{userId}/invoices/`
- ✅ Download feature with 1-hour presigned URLs
- ✅ Orphaned file cleanup admin API
- ✅ AES256 server-side encryption
- ✅ Zero-downtime migration (existing local files continue working)
- ✅ Storage abstraction layer using Strategy Pattern

**Files Created**:
- `src/lib/storage/storage-strategy.ts` - Storage interface
- `src/lib/storage/s3-client.ts` - S3 client singleton
- `src/lib/storage/local-storage.ts` - Local filesystem wrapper
- `src/lib/storage/s3-storage.ts` - S3 implementation
- `src/lib/storage/storage-factory.ts` - Strategy factory
- `src/lib/storage/index.ts` - Public exports
- `src/app/api/invoices/download/route.ts` - Download endpoint
- `src/app/api/admin/cleanup-orphaned-files/route.ts` - Orphaned file cleanup

**Files Modified**:
- `src/app/api/upload/route.ts` - Upload to S3 with storage abstraction
- `src/app/api/process/route.ts` - Read from S3/local
- `src/app/api/invoices/route.ts` - Delete from S3/local
- `src/app/api/invoices/bulk-delete/route.ts` - Bulk delete from S3/local
- `src/components/InvoiceTable.tsx` - Added download button
- `src/components/InvoiceDetailDialog.tsx` - Added download button
- `.env.example` - AWS S3 configuration documentation
- `README.md` - AWS S3 setup instructions

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

### 5. Additional OAuth Providers (Microsoft, Apple) ✅
**Current Issue**: Only Google OAuth supported
**Impact**: Medium - broader user base
**Effort**: Small-Medium (1-2 days per provider)
**Status**: ✅ Completed (2026-01-02)

**Completed Features**:
- ✅ Microsoft Azure AD OAuth provider with multi-tenant support
- ✅ Apple Sign-In provider with private key authentication
- ✅ Account linking enabled for all OAuth providers
- ✅ Login UI updated with Microsoft and Apple buttons with brand icons
- ✅ Comprehensive setup documentation in README.md
- ✅ Environment variable documentation in .env.example

**Files Modified**:
- `src/lib/auth.ts` - Added AzureADProvider and AppleProvider with account linking
- `src/app/login/page.tsx` - Added Microsoft and Apple OAuth buttons
- `.env.example` - Documented Azure AD and Apple environment variables with setup comments
- `README.md` - Added detailed setup guides for Microsoft Azure AD and Apple Sign-In

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

### 7. User Profile Page ✅
**Current Issue**: No dedicated page for users to view and edit their profile information
**Impact**: Medium - improves user experience and account management
**Effort**: Small-Medium (2-3 days)
**Status**: ✅ Completed (2026-01-03)

**Completed Features**:
- ✅ Display user information (name, email, profile picture)
- ✅ Edit profile details (name)
- ✅ View account creation date
- ✅ View connected OAuth providers (Google, Microsoft, Apple)
- ✅ Display email verification status with badge
- ✅ Avatar upload and management (JPEG, PNG, GIF, WebP up to 5MB)
- ✅ Comprehensive account statistics dashboard:
  - Total/processed/failed/pending invoices
  - Success rate calculation
  - Total spending from processed invoices
  - Vendors and requests counts
  - Estimated storage usage
  - Account age in days
- ✅ Avatar storage via S3 or local storage
- ✅ Responsive two-column layout with loading states

**Files Created**:
- `src/app/profile/page.tsx` - Profile page UI
- `src/app/api/profile/route.ts` - Profile update endpoint
- `src/app/api/profile/avatar/route.ts` - Avatar upload endpoint
- `src/components/ProfileForm.tsx` - Profile edit form component
- `src/components/AvatarUpload.tsx` - Avatar upload component with validation
- `src/components/AccountStats.tsx` - Statistics display component with cards
- `src/app/api/profile/route.ts` - Profile GET/PATCH endpoint
- `src/app/api/profile/avatar/route.ts` - Avatar upload/delete endpoint
- `src/app/api/profile/stats/route.ts` - Account statistics endpoint

**Files Modified**:
- `src/components/header.tsx` - Added Profile link to navigation
- `prisma/schema.prisma` - Added lastLogin field to User model

---

### 8. Settings Page ✅
**Current Issue**: No centralized settings page for application preferences and configurations
**Impact**: Medium - improves user control and customization
**Effort**: Medium (3-4 days)
**Status**: ✅ Completed (2026-01-03)

**Completed Features**:
- ✅ **Appearance Settings**:
  - Theme selection (light, dark, system)
  - Language/locale preferences
  - Date format preferences (MM/DD/YYYY vs DD/MM/YYYY)
  - Currency display preferences (handled in Processing settings)
- ✅ **Notification Settings**:
  - Email notifications for completed processing
  - Email notifications for failed processing
  - Weekly summary emails
- ✅ **Processing Settings**:
  - Default currency for new invoices
  - Auto-process on upload toggle
  - PDF retention policy (keep originals, delete after X days)
- ✅ **Export Settings**:
  - Default export format (Excel, CSV, JSON)
  - Export filename template with placeholders
- ✅ **Security Settings**:
  - Password change with validation
  - Security tips and best practices
  - OAuth account detection

**Files Created**:
- `src/app/settings/page.tsx` - Settings page UI with 5 tabs
- `src/app/api/settings/route.ts` - Settings GET/PATCH endpoints
- `src/app/api/settings/password/route.ts` - Password change endpoint
- `src/components/settings/AppearanceSettings.tsx` - Theme, locale, date format
- `src/components/settings/NotificationSettings.tsx` - Email notification toggles
- `src/components/settings/ProcessingSettings.tsx` - Currency, auto-process, retention
- `src/components/settings/ExportSettings.tsx` - Export format and templates
- `src/components/settings/SecuritySettings.tsx` - Password change with validation

**Files Modified**:
- `src/components/header.tsx` - Added Settings link to navigation
- `prisma/schema.prisma` - Added UserSettings model with all preference fields

**Database Schema Implemented**:
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

### 9. Custom AI Model Provider Selection ✅
**Current Issue**: Hardcoded to use only OpenAI GPT-4o-mini model
**Impact**: Medium - provides flexibility, cost optimization, and performance tuning
**Effort**: Medium-Large (4-5 days)
**Status**: ✅ Completed (2026-01-03)

**Completed Features**:
- ✅ **Multiple AI Providers**: OpenAI, Anthropic, Google Gemini, DeepSeek, OpenRouter
- ✅ **Configuration hierarchy**: Vendor overrides > User preference > System default
- ✅ **Settings UI**: New "AI Models" tab to configure provider/model/API keys
- ✅ **Architecture**: Strategy pattern with `AIProvider` factory and `ModelSelector`

**Files Created/Modified**:
- `src/lib/ai/providers/` (Base, OpenAI, DeepSeek, etc.)
- `src/lib/ai/model-selector.ts`
- `src/app/api/ai-config/route.ts`
- `src/components/settings/AIModelSettings.tsx`

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

### 10. Batch Upload Request Management with Audit Trails ✅
**Current Issue**: No grouping mechanism for batch uploads, no audit trail for operations
**Impact**: Medium - improves workflow organization, compliance, and debugging
**Effort**: Large (23-24 days)
**Status**: ✅ Completed (2026-01-02)

**Completed Features**:
- ✅ **Request Management**:
  - Group multiple invoice uploads into logical "requests" (batches)
  - Request metadata (title, description, default vendor)
  - Request lifecycle: Draft → Processing → Completed/Partial/Failed
  - Statistics tracking (total invoices, processed, failed, pending, queuedCount, processingCount, total amount)
- ✅ **Editing Capabilities**:
  - Add/remove files from draft requests
  - Update request metadata
  - Assign default vendor to entire batch
  - Reprocess failed invoices within request
- ✅ **Audit Trail**:
  - Track request lifecycle events (created, submitted, completed)
  - Track file-level events (uploaded, processed, failed, deleted)
  - Track user actions (who did what, when)
  - Record IP address and user agent for security
  - Change tracking (previous/new values)
- ✅ **UI Features**:
  - Request list page with filtering, search, pagination
  - Request detail page with invoices, statistics, audit timeline
  - Create request flow with file upload integration
  - Visual timeline of audit events
- ✅ **Frontend Polling**: Automatic status updates every 10 seconds while processing

**Database Schema Implemented**:
```prisma
model UploadRequest {
  id               String        @id @default(cuid())
  userId           String
  user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  title            String?
  description      String?       @db.Text
  status           RequestStatus @default(DRAFT)
  defaultVendorId  String?
  defaultVendor    Vendor?       @relation(fields: [defaultVendorId], references: [id], onDelete: SetNull)
  autoProcess      Boolean       @default(false)

  totalInvoices    Int           @default(0)
  processedCount   Int           @default(0)
  failedCount      Int           @default(0)
  pendingCount     Int           @default(0)
  totalAmount      Float?

  submittedAt      DateTime?
  completedAt      DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  invoices         Invoice[]
  auditLogs        RequestAuditLog[]

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

enum RequestStatus {
  DRAFT
  PROCESSING
  COMPLETED
  PARTIAL
  FAILED
}

model RequestAuditLog {
  id               String          @id @default(cuid())
  requestId        String
  request          UploadRequest   @relation(fields: [requestId], references: [id], onDelete: Cascade)
  userId           String
  user             User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  eventType        AuditEventType
  eventCategory    AuditCategory
  summary          String
  details          String?         @db.Text
  targetType       String?
  targetId         String?
  previousValue    String?         @db.Text
  newValue         String?         @db.Text
  ipAddress        String?
  userAgent        String?
  createdAt        DateTime        @default(now())

  @@index([requestId])
  @@index([userId])
  @@index([eventType])
  @@index([createdAt])
}

// Add to Invoice model:
requestId        String?
request          UploadRequest? @relation(fields: [requestId], references: [id], onDelete: SetNull)
```

**API Endpoints Implemented**:
- `POST /api/requests` - Create new request
- `GET /api/requests` - List requests (filtering, pagination, search)
- `GET /api/requests/[requestId]` - Get request details with invoices
- `PATCH /api/requests/[requestId]` - Update request metadata
- `DELETE /api/requests/[requestId]` - Delete request (unlink invoices)
- `POST /api/requests/[requestId]/submit` - Submit for processing
- `POST /api/requests/[requestId]/retry` - Retry failed invoices
- `POST /api/requests/[requestId]/files` - Add files to request
- `DELETE /api/requests/[requestId]/files` - Remove files from request
- `GET /api/requests/[requestId]/audit` - Get audit logs
- `GET /api/requests/[requestId]/timeline` - Get timeline view
- `GET /api/requests/[requestId]/stats` - Get statistics
- `POST /api/requests/bulk-delete` - Delete multiple requests
- `POST /api/requests/bulk-export` - Export multiple requests (JSON/CSV)

**Files Created**:
- `prisma/schema.prisma` - Add UploadRequest, RequestAuditLog models
- `src/app/api/requests/route.ts` - Request CRUD
- `src/app/api/requests/[requestId]/route.ts` - Request detail/update/delete
- `src/app/api/requests/[requestId]/submit/route.ts` - Submit workflow
- `src/app/api/requests/[requestId]/retry/route.ts` - Retry failed
- `src/app/api/requests/[requestId]/files/route.ts` - File management
- `src/app/api/requests/[requestId]/audit/route.ts` - Audit logs
- `src/app/api/requests/[requestId]/stats/route.ts` - Statistics
- `src/lib/audit/logger.ts` - Audit logging utilities
- `src/lib/audit/middleware.ts` - Request metadata extraction
- `src/lib/requests/statistics.ts` - Statistics computation
- `src/lib/requests/status-calculator.ts` - Status determination
- `src/types/request.ts` - TypeScript types and Zod schemas
- `src/app/requests/page.tsx` - Request list page
- `src/app/requests/[requestId]/page.tsx` - Request detail page
- `src/app/requests/new/page.tsx` - Create request page
- `src/components/requests/RequestTable.tsx` - Request list table
- `src/components/requests/RequestDetailCard.tsx` - Request metadata
- `src/components/requests/RequestStatistics.tsx` - Statistics display
- `src/components/requests/RequestFilters.tsx` - Filter UI
- `src/components/requests/AuditTrail.tsx` - Audit log visualization
- `src/components/requests/RequestTimeline.tsx` - Timeline component
- `src/components/requests/CreateRequestDialog.tsx` - Create dialog
- `src/components/requests/AddFilesDialog.tsx` - Add files dialog
- `src/components/requests/RequestStatusBadge.tsx` - Status badge
- Plus additional utility files for statistics and status calculation

**Files Modified**:
- `src/app/api/upload/route.ts` - Add requestId support for linking uploads
- `src/app/api/process/route.ts` - Add audit logging, update request status
- `src/components/FileUpload.tsx` - Add requestId prop support
- `src/components/InvoiceTable.tsx` - Add "Request" column
- `src/app/page.tsx` - Add requests section to dashboard
- `src/components/header.tsx` - Add navigation link to requests
- `src/workers/processor-logic.ts` - Integrated request statistics updates during processing
- `src/app/requests/page.tsx` - Added automatic polling for processing requests
- `src/app/requests/[requestId]/page.tsx` - Added automatic polling when request is processing

**Implementation Summary**:
All phases completed successfully with comprehensive implementation including:
- ✅ Database schema with UploadRequest and AuditLog models
- ✅ Full CRUD API for request management (create, read, update, delete)
- ✅ Comprehensive audit trail system with forensic tracking (IP, user agent, before/after values)
- ✅ Real-time statistics tracking and automatic updates during processing
- ✅ Frontend with request list page, detail pages, and interactive UI components
- ✅ Automatic polling for real-time status updates (10-second intervals)
- ✅ Bulk operations (export multiple requests, delete batches)
- ✅ Timeline and audit trail visualization with tabs
- ✅ Full integration with existing invoice processing workflow
- ✅ Request status automatically updates: draft → processing → completed/partial/failed

**Key Design Decisions**:
- **Backward Compatibility**: Existing invoices with `requestId=null` are valid "orphaned" invoices
- **Soft Delete**: Deleting request unlinks invoices (sets `requestId=null`), doesn't cascade delete
- **Real-time Statistics**: Computed on-demand from invoices for accuracy
- **Authorization**: Users can only access requests they created
- **Auto-Process Option**: When enabled, files are processed immediately on upload

**Benefits**:
- Organize batch uploads into logical groups
- Track complete history of all operations for compliance
- Improve debugging with detailed audit trail
- Better workflow management for processing large batches
- Enhanced visibility into batch processing status
- Compliance and security (who did what, when)
- Real-time status updates with automatic polling

---

## 🟢 Low Priority - Nice to Have

### 11. Advanced Analytics Dashboard
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

### 12. Webhook Notifications
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

### 13. API Documentation (Swagger/OpenAPI)
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

### 14. Mobile App Support
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

### Phase 1 - Production Ready ✅ **ALL COMPLETED**
1. ~~Background job processing~~ ✅ **COMPLETED**
2. ~~Cloud storage integration~~ ✅ **COMPLETED**
3. ~~Database migration to PostgreSQL~~ ✅ **COMPLETED**

### Phase 2 - Enhanced Features ✅ **MOSTLY COMPLETED**
4. GPT-4 Vision for scanned documents
5. ~~Additional OAuth providers~~ ✅ **COMPLETED**
6. ~~Invoice templates & vendor management~~ ✅ **COMPLETED**
7. ~~User Profile Page~~ ✅ **COMPLETED**
8. ~~Settings Page~~ ✅ **COMPLETED**
9. ~~Custom AI Model Provider Selection~~ ✅ **COMPLETED**
10. ~~Batch Upload Request Management with Audit Trails~~ ✅ **COMPLETED**

### Phase 3 - Advanced Features (3-4 weeks)
11. Advanced analytics dashboard
12. Webhook notifications
13. API documentation

### Phase 4 - Future (timeline flexible)
14. Mobile app support

---

## Known Limitations (Technical Debt)

From CLAUDE.md and codebase analysis:

1. **Scanned PDFs**: Text-based extraction only - GPT-4 Vision integration planned but not implemented
2. ~~**Local File Storage**: Files stored in `public/uploads/` - not suitable for production~~ ✅ **RESOLVED** - Migrated to AWS S3 with hybrid support (2025-12-31)
3. ~~**No Background Jobs**: Processing is synchronous - large PDFs may timeout~~ ✅ **RESOLVED** - BullMQ job queue with Redis implemented (2026-01-02)
4. ~~**Hardcoded AI Model**: Only supports OpenAI GPT-4o-mini~~ ✅ **RESOLVED** - Implemented multi-provider support (OpenAI, Anthropic, DeepSeek, etc.) (2026-01-03)
5. ~~**SQLite**: Not suitable for concurrent writes in high-traffic scenarios~~ ✅ **RESOLVED** - Migrated to PostgreSQL (2025-12-30)
6. ~~**No Vendor Management**: Manual categorization required~~ ✅ **RESOLVED** - Vendor templates & detection implemented (2025-12-30)

---

## Notes

- All effort estimates are approximate and may vary based on complexity discovered during implementation
- Priority levels can be adjusted based on user feedback and business requirements
- Each item should be broken down into smaller tasks when work begins
- Update status as work progresses: Not Started → In Progress → Completed

---

Last Updated: 2026-01-03 (Updated item #8 Settings Page to ✅ Completed; comprehensive settings management with 5 tabbed categories for appearance, notifications, processing, export, and security preferences)
