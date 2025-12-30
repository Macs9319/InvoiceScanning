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

### 6. Invoice Templates & Vendor Management
**Current Issue**: No vendor recognition or templates for common invoice formats
**Impact**: Medium - improves extraction accuracy and user experience
**Effort**: Large (5-7 days)
**Status**: Not Started

**Suggested Approach**:
- Create vendor database with common invoice patterns
- Implement vendor detection from invoice text
- Create custom extraction prompts per vendor
- Allow users to save/manage custom templates
- Add vendor-specific field mappings

**Files to Create**:
- `src/lib/vendors/` - Vendor management module
- `prisma/schema.prisma` - Add Vendor and Template models
- `src/app/api/vendors/` - Vendor CRUD endpoints
- `src/components/VendorManager.tsx` - UI for vendor management

---

## 🟢 Low Priority - Nice to Have

### 7. Advanced Analytics Dashboard
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

### 8. Webhook Notifications
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

### 9. API Documentation (Swagger/OpenAPI)
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

### 10. Mobile App Support
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
3. Database migration to PostgreSQL

### Phase 2 - Enhanced Features (2-3 weeks)
4. GPT-4 Vision for scanned documents
5. Additional OAuth providers
6. Invoice templates & vendor management

### Phase 3 - Advanced Features (3-4 weeks)
7. Advanced analytics dashboard
8. Webhook notifications
9. API documentation

### Phase 4 - Future (timeline flexible)
10. Mobile app support

---

## Known Limitations (Technical Debt)

From CLAUDE.md and codebase analysis:

1. **Scanned PDFs**: Text-based extraction only - GPT-4 Vision integration planned but not implemented
2. **Local File Storage**: Files stored in `public/uploads/` - not suitable for production (see #2 above)
3. **No Background Jobs**: Processing is synchronous - large PDFs may timeout (see #1 above)
4. ~~**SQLite**: Not suitable for concurrent writes in high-traffic scenarios~~ ✅ **RESOLVED** - Migrated to PostgreSQL

---

## Notes

- All effort estimates are approximate and may vary based on complexity discovered during implementation
- Priority levels can be adjusted based on user feedback and business requirements
- Each item should be broken down into smaller tasks when work begins
- Update status as work progresses: Not Started → In Progress → Completed

---

Last Updated: 2025-12-30
