# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Invoice Scanner is a Next.js 15 application that uses AI (OpenAI, Anthropic, Google, etc.) to extract structured data from invoice and receipt PDFs.

**Core Features**:
- Multi-provider AI extraction (OpenAI, Anthropic, Google)
- Multi-provider authentication (email/password, Google OAuth, Microsoft Azure AD)
- Asynchronous background job processing (BullMQ + Redis)
- Request management with comprehensive audit trails
- Cloud storage (AWS S3) and local filesystem support
- Multi-format exports (Excel, CSV, JSON)
- Vendor management with AI-powered detection
- Advanced filtering, search, and bulk operations
- Dark mode theming
- Vision API support for scanned documents with self-contained PDF-to-image converter

**Tech Stack**: Next.js 15, NextAuth.js v5, PostgreSQL/Prisma, BullMQ/Redis, AWS S3, TanStack Table, Radix UI, Tailwind CSS

## Quick Start

### Development Commands

```bash
# Installation
npm install

# Development
npm run dev              # Start Next.js dev server (http://localhost:3000)
npm run dev:all          # Start dev server + worker (recommended)
npm run worker:dev       # Start worker separately

# Production
npm run build            # Build application
npm run build:worker     # Build worker
npm start                # Start production server
npm run worker           # Start production worker

# Tools
npm run lint             # Run linter
npx prisma studio        # Open database GUI
npx prisma generate      # Regenerate Prisma client
npx prisma migrate dev   # Create and apply migrations
npx prisma db push       # Push schema without migrations
```

### Database Setup

**PostgreSQL** (recommended for production):
```bash
# Set DATABASE_URL in .env.local:
# postgresql://user:password@localhost:5432/invoice_scanner?schema=public

npx prisma generate
npx prisma migrate dev --name init  # Requires CREATEDB permission
# OR
npx prisma db push                  # If no CREATEDB permission

# Verify
psql -U user -d database -c "\dt"
```

**Redis** (required for background jobs):
```bash
redis-cli ping                      # Check connection
redis-cli --scan --pattern bull:*   # List queues
```

## Architecture

### Authentication Flow

NextAuth.js v5 with multiple providers:

**Providers**:
- **Credentials**: Email/password with bcrypt hashing (10 rounds)
- **Google OAuth**: Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- **Microsoft Azure AD**: Requires `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`

**Flow**:
1. **Signup**: `/api/signup` → validates (Zod) → hashes password → creates user → sends verification email (if SMTP configured)
2. **Email Verification**: `/api/verify-email` → validates token → marks email verified
3. **Login**: `/login` → credentials or OAuth → NextAuth validates → JWT session → redirects
4. **Password Reset**: `/api/forgot-password` → generates token → sends email → `/api/reset-password` → validates → updates password
5. **Protected Routes**: All API routes call `await auth()` and return 401 if unauthenticated

### Processing Pipeline

Three-stage pipeline for invoice processing:

1. **Upload** (`/api/upload`): Validates auth → saves PDF to storage (S3/local) → creates DB record with `status: "pending"` and `userId`
2. **AI Processing** (`/api/process`): Validates auth/ownership → queues job (BullMQ) or processes synchronously → extracts text → detects if scanned → **automatic routing**:
   - **Text-based PDFs**: Normal text extraction with Gemini 2.5 Flash (~$0.0002/page)
   - **Scanned PDFs**: Native PDF processing with Gemini 2.5 Flash (~$0.0002/page, no image conversion)
   - Parses response → saves with line items
3. **Export** (`/api/export`): Validates auth → queries user's invoices → generates Excel/CSV/JSON

### Background Job Processing

**BullMQ with Redis** for asynchronous processing:

**Operational Modes**:
- `WORKER_MODE=separate` (default): Dedicated worker process for scalability
- `WORKER_MODE=embedded`: Worker runs within Next.js process
- `WORKER_MODE=disabled`: Synchronous processing (Redis unavailable)

**Job Flow**:
1. `/api/process` dispatches job to queue (`status: "queued"`)
2. Worker picks up job (`status: "processing"`)
3. Worker extracts text, calls AI, validates (Zod)
4. Worker saves results (`status: "processed"` or `"failed"`)
5. Frontend polls `/api/invoices/status` every 10-20 seconds
6. Failed jobs retry with exponential backoff (3 attempts)

**Configuration**:
- Concurrency: 5 jobs per worker
- Timeout: 2 minutes (configurable via `JOB_TIMEOUT`)
- Retry: Exponential backoff starting at 5 seconds

### Cloud Storage (Strategy Pattern)

Flexible file storage abstraction:

**Storage Providers**:
- `LocalStorage`: Filesystem storage in `public/uploads/`
- `S3Storage`: AWS S3 with presigned URLs (1-hour expiry)
- `StorageFactory`: Selects provider based on `STORAGE_PROVIDER` env var and file URL prefix

**File URL Convention**:
- Local: `/uploads/filename.pdf` (relative path)
- S3: `s3://bucket/users/{userId}/invoices/filename.pdf` (full URI)

**Hybrid Support**: System transparently handles both local and S3 files, enabling zero-downtime migration.

### Request Management

Groups invoice uploads into logical batches with audit trails:

**Request Lifecycle**:
- `draft` - Files can be added/removed, not yet submitted
- `processing` - At least one invoice queued or processing
- `completed` - All invoices successfully processed
- `partial` - Some processed, some failed
- `failed` - All invoices failed

**Audit Trail**:
- Tracks all operations: request lifecycle, invoice operations, vendor operations
- Records IP address and user agent for forensic analysis
- Stores before/after values for data changes
- Severity levels: info, warning, error
- Non-blocking: audit failures don't break primary operations

**Statistics**:
- Real-time metrics: totalInvoices, processedCount, failedCount, etc.
- Financial data: totalAmount, averageAmount (by currency)
- Performance: averageProcessingTime (milliseconds)

### AI Extraction & Vision API

**AI Provider Architecture** (Strategy Pattern):
- `AIProvider` abstract base class
- Implementations: `OpenAIProvider`, `DeepSeekProvider`, `OpenRouterProvider`
- `AIProviderFactory` instantiates provider based on configuration
- `ModelSelector` determines effective config (Vendor Override > User Config > System Default)

**Vendor Detection** (three strategies):
1. Identifier Matching (fast, free): Tax IDs, Company Registration numbers
2. AI Detection (accurate): GPT-4o-mini analyzes invoice text
3. Fuzzy Matching (fallback): Partial string matching

**Vendor Templates**:
- Custom prompts for AI extraction
- Custom fields beyond standard invoice fields
- Field mappings and validation rules

**Vision API Integration**:
- Self-contained PDF-to-image converter using `pdf-to-png-converter`
- Zero external dependencies (no Cloudinary required)
- Server-side rendering, no network round-trips
- Free PDF conversion (only pay for OpenAI Vision API usage)
- Manual trigger via UI for scanned/poor-quality PDFs
- Automatic detection using text density heuristics

**Extraction Prompt**: Instructs GPT-4 to return JSON with `invoiceNumber`, `date` (ISO 8601), `totalAmount`, `currency`, `lineItems[]`. Uses `null` for missing fields.

## Database Schema

### Core Models

**User**: Authentication entity
- `email`: Unique identifier
- `password`: Bcrypt hashed (nullable for OAuth-only)
- `emailVerified`: Verification timestamp
- Relationships: invoices, accounts, sessions, vendors, uploadRequests, auditLogs

**UploadRequest**: Batch grouping for invoices
- `title`: Request name (auto-generated or user-provided)
- `status`: Lifecycle state (draft, processing, completed, partial, failed)
- `defaultVendorId`: Optional vendor for all invoices
- Cached statistics: totalInvoices, processedCount, failedCount, etc.
- Relationships: invoices, auditLogs

**Invoice**: Primary entity
- `userId`: Ensures user isolation
- `requestId`: Links to UploadRequest (nullable, onDelete: SetNull)
- `status`: "pending" → "processing" → "processed"/"failed"
- `rawText`: Full PDF text (pdfreader)
- `aiResponse`: Raw JSON from AI OR error details
- `fileUrl`: Local path or S3 URI
- `vendorId`, `detectedVendorId`, `templateId`: Vendor integration
- `jobId`, `processingStartedAt`, `retryCount`: Background job tracking
- Relationships: lineItems

**LineItem**: Invoice line items
- `invoiceId`: Parent invoice
- `order`: Display sequence
- Fields: description (required), quantity, unitPrice, amount (nullable)

**Vendor**: Vendor information
- `identifiers`: JSON array (Tax ID, Company Registration, etc.)
- Relationships: templates, invoices

**VendorTemplate**: Custom extraction templates
- `customPrompt`: Additional AI instructions
- `customFields`, `fieldMappings`, `validationRules`: JSON configs
- `isActive`: Only active templates used
- Usage stats: `invoiceCount`, `lastUsedAt`

**AuditLog**: Comprehensive audit trail
- `eventType`: Specific action (request_created, invoice_uploaded, etc.)
- `eventCategory`: Grouping (request_lifecycle, invoice_operation, etc.)
- `severity`: info, warning, error
- Change tracking: `previousValue`, `newValue`
- Forensic data: `ipAddress`, `userAgent`
- `targetType`, `targetId`: Links to resources
- Append-only: No updates/deletes via API

### NextAuth Models

- **Account**: OAuth provider tokens
- **Session**: JWT sessions (no DB sessions)
- **VerificationToken**: Email verification
- **PasswordResetToken**: Password reset

## Configuration

### Required Environment Variables

```env
# OpenAI (Required)
OPENAI_API_KEY=sk-...

# Database (Required)
DATABASE_URL="postgresql://user:password@localhost:5432/invoice_scanner?schema=public"
NODE_ENV=development

# NextAuth (Required)
AUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# Redis (Required for background jobs)
REDIS_URL=redis://localhost:6379
```

### Optional Environment Variables

```env
# Alternative AI Providers
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Microsoft Azure AD OAuth
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=common  # For multi-tenant

# Email/SMTP (for verification and password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_NAME="Invoice Scanner"
SMTP_FROM_EMAIL=your_email@gmail.com

# AWS S3 Cloud Storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=invoice-scanner-files
S3_PRESIGNED_URL_EXPIRY=3600
STORAGE_PROVIDER=s3  # Or 'local'

# Background Job Configuration
WORKER_MODE=separate  # Or 'embedded', 'disabled'
QUEUE_NAME=invoice-processing
JOB_ATTEMPTS=3
JOB_BACKOFF_TYPE=exponential
JOB_BACKOFF_DELAY=5000
JOB_TIMEOUT=120000
WORKER_CONCURRENCY=5
NEXT_PUBLIC_POLLING_INTERVAL=10000
```

### Setup Guides

**Google OAuth**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add redirect URIs: `http://localhost:3000/api/auth/callback/google` (dev), `https://yourdomain.com/api/auth/callback/google` (prod)
4. Copy Client ID and Secret to `.env.local`

**Email/SMTP**:
- Gmail: Use [App Password](https://support.google.com/accounts/answer/185833)
- Other providers: Use SMTP credentials
- If not configured, emails log to console

**AWS S3**:
1. Create S3 bucket with Block Public Access ✅ and AES256 encryption ✅
2. Create IAM user with permissions: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:HeadObject`, `s3:ListBucket`
3. Add credentials to `.env.local`
4. Set `STORAGE_PROVIDER=s3`
5. Existing local files continue working; new uploads go to S3

## Development Patterns

### File Storage

```typescript
import { getDefaultStorage, getStorageForFile } from "@/lib/storage";

// Upload
const storage = getDefaultStorage();
const fileUrl = await storage.upload(buffer, userId);

// Download
const storage = getStorageForFile(invoice.fileUrl);
const buffer = await storage.download(invoice.fileUrl);
// For S3: const url = await storage.getUrl(invoice.fileUrl);

// Delete
await storage.delete(invoice.fileUrl);
```

Storage factory auto-selects provider based on:
1. File URL prefix (local: `/uploads/`, S3: `s3://`)
2. `STORAGE_PROVIDER` env var for new uploads

### Adding Export Formats

1. Create `src/lib/export/newformat.ts` with export function
2. Add format to `ExportOptions.format` in `src/types/invoice.ts`
3. Update `src/app/api/export/route.ts` switch statement
4. Add button to `src/components/ExportButtons.tsx`

### Modifying AI Schema

1. Update Zod schemas in `src/types/invoice.ts`
2. Update prompt in `src/lib/ai/extractor.ts`
3. Update `prisma/schema.prisma` if adding persistent fields
4. Run `npx prisma migrate dev --name descriptive_name`

### Protected API Routes

```typescript
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // 1. Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Filter by user
  const invoices = await prisma.invoice.findMany({
    where: { userId: session.user.id }
  });

  return NextResponse.json({ invoices });
}
```

**Security**:
- Authentication: `await auth()` returns 401 if unauthenticated
- Data filtering: Query by `userId: session.user.id`
- Ownership verification: Check `resource.userId === session.user.id` (return 403 if not owner)
- Password security: Bcrypt hashing, never plain text

### Working with Prisma

```typescript
// Include relations
await prisma.invoice.findMany({
  include: { lineItems: true }
});

// After schema changes
npx prisma migrate dev --name descriptive_name
npx prisma generate
```

## Features

### UI Capabilities

- **Dark Mode**: System theme detection, toggle in sidebar, persists in localStorage
- **Loading States**: Skeleton loaders during data fetch
- **Invoice Details**: Modal with full invoice data, line items, raw text, AI response
- **Delete**: Confirmation dialog, deletes DB record and physical file
- **Advanced Filtering**: Search, status/currency/date/amount filters, pagination (10 per page)
- **Bulk Operations**: Row selection, bulk export/delete/retry/vendor assignment
- **Error Handling**: Alert icons for failures, retry button, detailed error modals

### Vendor Management

- Vendor profiles with identifiers (Tax ID, etc.)
- Custom extraction templates per vendor
- Three-strategy auto-detection (identifier, AI, fuzzy)
- Field mapping and validation rules
- Bulk vendor assignment
- Template usage statistics

### Request Management

- Batch uploads into logical groups
- Auto-created or manual request creation
- Lifecycle tracking (draft → processing → completed/partial/failed)
- Real-time statistics dashboard
- Visual timeline with chronological events
- Detailed audit logs with filtering
- Bulk operations (export, delete)

## Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/     # NextAuth handlers
│   │   ├── signup/                 # User registration
│   │   ├── upload/                 # File upload → storage + DB
│   │   ├── process/                # AI processing dispatcher
│   │   ├── invoices/               # Invoice CRUD, bulk operations
│   │   ├── vendors/                # Vendor CRUD, templates
│   │   ├── requests/               # Request management, audit logs
│   │   └── export/                 # Excel/CSV/JSON generation
│   ├── login/, verify-email/, reset-password/  # Auth pages
│   ├── vendors/                    # Vendor management UI
│   ├── requests/                   # Request management UI
│   └── page.tsx                    # Main dashboard
├── components/
│   ├── FileUpload, InvoiceTable, InvoiceDetailDialog
│   ├── vendors/                    # Vendor components
│   ├── requests/                   # Request components
│   └── ui/                         # shadcn/ui components
├── lib/
│   ├── auth.ts                     # NextAuth config
│   ├── ai/                         # AI extraction, vendor detection
│   ├── pdf/
│   │   ├── parser.ts               # PDF text extraction
│   │   └── image-converter.ts     # PDF-to-image converter
│   ├── queue/                      # BullMQ job queue
│   ├── storage/                    # Storage abstraction
│   ├── export/                     # Excel/CSV/JSON generators
│   ├── requests/, audit/           # Request and audit utilities
│   └── db/prisma.ts                # Prisma client
├── workers/                        # Background worker processes
├── hooks/
│   └── useInvoicePolling.ts        # Frontend polling
└── types/                          # Zod schemas + TypeScript types
```

## Cost & Performance

### AI Cost Management

Using `gpt-4o-mini` for cost efficiency:
- **Cost**: ~$0.001-0.005 per invoice (60-80% cheaper than GPT-4 Turbo)
- **Pricing**: $0.150 per 1M input tokens, $0.600 per 1M output tokens
- Invoices cached in database (no reprocessing)
- Monitor usage at platform.openai.com

**Cost Comparison**:
- GPT-4o-mini: ~$0.001-0.005 per invoice ✅
- GPT-4 Turbo: ~$0.01-0.05 per invoice
- GPT-4: ~$0.03-0.15 per invoice

### Known Limitations

1. **Scanned PDFs**: Text extraction is default. For scanned/poor-quality PDFs, use manual Vision API reprocessing (higher cost but more accurate). Uses self-contained converter with zero external dependencies.
2. **No Automated Tests**: Test suite not yet implemented. Consider adding Jest or Vitest.

## Changelog

### Recent Improvements

**2026-01-04: Self-Contained PDF-to-Image Converter**
- Eliminated Cloudinary dependency
- Implemented zero-external-dependency converter using `pdf-to-png-converter`
- Server-side rendering with no network round-trips
- Free PDF conversion (only pay for OpenAI Vision API)
- Updated Vision API route (`/api/invoices/[id]/reprocess-vision`)
- Updated UI components to remove Cloudinary references

**2026-01-02: Request Management with Audit Trails**
- Batch upload requests to organize invoices
- Request lifecycle management (draft → processing → completed/partial/failed)
- Real-time statistics dashboard
- Comprehensive audit trail for compliance
- Timeline view with chronological events
- Bulk operations (export, delete)
- Backward compatible with orphaned invoices

**2026-01-02: Background Job Processing**
- BullMQ job queue with Redis
- Dedicated worker process (5 concurrent jobs)
- Real-time status updates via frontend polling
- Automatic retry with exponential backoff (3 attempts)
- Three operational modes (separate worker, embedded, synchronous)
- Serverless support (Vercel + Upstash)
- Graceful degradation when Redis unavailable

**2025-12-31: AWS S3 Cloud Storage Integration**
- Storage Strategy Pattern for flexible file storage
- AWS S3 with presigned URLs (1-hour expiry)
- Hybrid local/S3 support for zero-downtime migration
- User-isolated storage (`users/{userId}/invoices/`)
- Server-side AES256 encryption
- Orphaned file cleanup API

**2025-12-30: PostgreSQL Database Migration**
- Migrated from SQLite to PostgreSQL
- Optimized @db.Text annotations
- SQLite still supported for development
- Migration guide created

**Multi-Provider Authentication**
- Email/password with bcrypt
- Google OAuth with account linking
- Microsoft Azure AD OAuth
- Email verification and password reset

**Vendor Management System**
- Vendor profiles with identifiers
- Custom extraction templates
- Three-strategy detection (identifier, AI, fuzzy)
- Field mapping and validation

**Bulk Operations**
- Row selection with checkboxes
- Bulk export (Excel/CSV/JSON)
- Bulk delete, retry, vendor assignment
- Selection persistence

**Advanced Filtering & Search**
- Search by invoice number, file name, line items
- Status/currency/date/amount filters
- Pagination (10 per page)

**Error Handling & Retry**
- Detailed error messages
- Retry functionality for failed invoices
- Loading states and progress indicators

**Cost Optimization**
- Switched from GPT-4 Turbo to GPT-4o-mini (60-80% cost reduction)

**UI Enhancements**
- Dark mode with system detection
- Skeleton loaders
- Comprehensive invoice detail modals
