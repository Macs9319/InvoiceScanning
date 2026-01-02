# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Invoice Scanner is a Next.js 15 application that uses OpenAI GPT-4o-mini to extract structured data from invoice and receipt PDFs. The app features user authentication with NextAuth.js, multi-user support with data isolation, batch processing with BullMQ, request management with comprehensive audit trails, persistent storage with PostgreSQL/Prisma, multi-format exports (Excel, CSV, JSON), advanced filtering and search, dark mode theming, error handling with retry functionality, vendor management with AI-powered detection, cloud storage with AWS S3, and detailed invoice viewing with loading states.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Note: No test suite currently configured
# To add tests, install jest/vitest and add test scripts to package.json

# Database operations
npx prisma generate          # Regenerate Prisma client after schema changes
npx prisma migrate dev       # Create and apply migrations (requires CREATEDB permission)
npx prisma db push           # Push schema without migrations (use if no CREATEDB permission)
npx prisma migrate reset     # Reset database (WARNING: deletes all data)
npx prisma studio            # Open Prisma Studio GUI for database inspection

# PostgreSQL-specific commands
psql -U user -d database -c "\dt"    # List all tables
psql -U user -d database -c "\di"    # List all indexes
```

## Architecture Overview

### Authentication Flow

The application uses NextAuth.js v5 (beta) with multiple authentication providers:

**Authentication Providers**:
- **Credentials**: Email/password authentication with bcrypt hashing
- **Google OAuth**: Sign in with Google (requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
- **Email account linking**: Allows linking Google accounts to existing email accounts

**Authentication Flow**:
1. **Signup**: `/api/signup` → validates input with Zod → checks email uniqueness → hashes password with bcrypt → creates user → sends verification email (if SMTP configured)
2. **Email Verification**: `/api/verify-email` → validates token → marks email as verified
3. **Login**: `/login` → submits credentials or uses Google OAuth → NextAuth validates → generates JWT session → redirects to main app
4. **Password Reset**: `/api/forgot-password` → generates reset token → sends email → `/api/reset-password` → validates token → updates password
5. **Session Management**: JWT stored in HTTP-only cookie, session validated on each API request
6. **Protected Routes**: All API routes check `await auth()` and return 401 if unauthenticated

### Three-Stage Processing Pipeline

The application follows a three-stage pipeline for invoice processing:

1. **Upload Stage** (`/api/upload`): Validates auth → saves PDF files to storage (S3 or local) via storage factory → creates database record with `status: "pending"` and `userId`
2. **AI Processing Stage** (`/api/process`): Validates auth + ownership → retrieves PDF from storage → extracts text from PDF → sends to OpenAI GPT-4o-mini → parses structured response → saves to database with line items
3. **Export Stage** (`/api/export`): Validates auth → queries user's invoices with line items → generates Excel/CSV/JSON files

### Cloud Storage Architecture (Strategy Pattern)

The application implements a **Storage Strategy Pattern** for flexible file storage:

**Storage Abstraction Layer**:
- `StorageStrategy` interface defines contract: `upload()`, `download()`, `delete()`, `getUrl()`
- `LocalStorage` implementation for filesystem storage in `public/uploads/`
- `S3Storage` implementation for AWS S3 cloud storage with presigned URLs
- `StorageFactory` selects provider based on `STORAGE_PROVIDER` env var and file URL prefix

**Hybrid Support**:
- System transparently handles both local files (`/uploads/...`) and S3 files (`s3://...`)
- Existing local files continue working after S3 migration
- User isolation in S3: `users/{userId}/invoices/{filename}`
- Presigned URLs (1-hour expiry) for secure S3 downloads via `/api/invoices/download`

**File URL Convention**:
- Local files: `/uploads/filename.pdf` (relative path from `public/`)
- S3 files: `s3://bucket/users/{userId}/invoices/filename.pdf` (full S3 URI stored in DB)
- Storage factory detects provider from URL prefix

### Request Management with Audit Trails

The application features a comprehensive **Request Management System** that groups invoice uploads into logical batches with full audit trail tracking for compliance and debugging.

**Request Lifecycle**:
- `draft` - Created, files can be added/removed, not yet submitted
- `processing` - At least one invoice queued or actively processing
- `completed` - All invoices successfully processed
- `partial` - Some processed, some failed (manual intervention needed)
- `failed` - All invoices failed processing

**Hybrid Request Creation**:
- **Auto-created**: Upload endpoint automatically creates requests with title like "Batch 2026-01-02 14:30"
- **Manual**: Users can create named requests (e.g., "December 2025 Expenses") via UI
- **Backward Compatible**: Existing invoices with `requestId: null` remain valid ("orphaned" invoices)

**Audit Trail Features**:
- Tracks all operations: request lifecycle, invoice operations, vendor operations, user actions
- Records IP address and user agent for forensic analysis
- Stores before/after values for data changes
- Severity levels: info, warning, error
- Organized by event categories for filtering and reporting
- Non-blocking: audit failures don't break primary operations

**Statistics Tracking**:
- Real-time metrics: totalInvoices, processedCount, failedCount, pendingCount, queuedCount, processingCount
- Financial data: totalAmount, averageAmount (by currency)
- Performance metrics: averageProcessingTime (milliseconds)
- Success rate calculation: processed / total * 100

**Request APIs**:
- `/api/requests` - Create request, list with filtering/pagination
- `/api/requests/[requestId]` - Get, update, delete individual request
- `/api/requests/[requestId]/files` - Add/remove invoices from request
- `/api/requests/[requestId]/submit` - Submit all pending invoices for AI processing
- `/api/requests/[requestId]/retry` - Retry all failed invoices
- `/api/requests/[requestId]/stats` - Get comprehensive statistics
- `/api/requests/[requestId]/audit` - Get filtered audit logs with pagination
- `/api/requests/[requestId]/timeline` - Get chronological event timeline
- `/api/requests/bulk-delete` - Delete multiple requests at once
- `/api/requests/bulk-export` - Export multiple requests to JSON/CSV
- `/api/audit` - Global audit log viewing with advanced filtering

**Frontend Components**:
- `/requests` - Request list page with search, filters, bulk operations
- `/requests/[requestId]` - Detail page with tabs: Invoices, Timeline, Audit Trail
- Real-time statistics dashboard with progress bars
- Visual timeline grouped by date
- Bulk selection and operations (export, delete)

### Data Flow

```
User signup/login → NextAuth → JWT session cookie → Authenticated requests
User uploads PDF → FileUpload component → /api/upload (auth check) → Saves to disk + DB with userId
User clicks "Process" → /api/process (auth + ownership check) → extractTextFromPDF() → extractInvoiceData() → Updates DB
User exports data → ExportButtons → /api/export?format=X (auth check) → Generates file with user's invoices only
```

### Key Libraries & Their Roles

- **NextAuth.js v5**: Authentication with Credentials and Google OAuth providers, JWT sessions
- **bcryptjs**: Password hashing (10 rounds)
- **nodemailer**: Email sending for verification and password reset (SMTP)
- **pdfreader**: Extracts raw text from PDF files (page by page)
- **OpenAI API**: GPT-4o-mini with JSON mode for structured data extraction
- **Zod**: Validates AI responses and user input before saving
- **Prisma**: ORM with PostgreSQL database (SQLite supported for local development)
- **xlsx**: Excel export with multi-sheet support
- **csv-writer**: CSV export
- **TanStack Table**: Frontend data table with sorting, filtering, selection
- **next-themes**: Dark mode support with system theme detection
- **Radix UI**: Accessible dialog, alert-dialog, select, checkbox components

### Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth handlers (GET, POST)
│   │   ├── signup/route.ts              # User registration endpoint
│   │   ├── verify-email/route.ts        # Email verification endpoint
│   │   ├── forgot-password/route.ts     # Password reset request endpoint
│   │   ├── reset-password/route.ts      # Password reset confirmation endpoint
│   │   ├── upload/route.ts              # File upload → disk + DB (auth required)
│   │   ├── process/route.ts             # PDF text extraction → AI → DB update (auth + ownership)
│   │   ├── invoices/
│   │   │   ├── route.ts                 # GET user's invoices, DELETE by ID (auth required)
│   │   │   ├── bulk-delete/route.ts     # Bulk delete endpoint (auth required)
│   │   │   └── bulk-assign-vendor/route.ts  # Bulk vendor assignment (auth required)
│   │   ├── vendors/
│   │   │   ├── route.ts                 # CRUD operations for vendors
│   │   │   ├── [vendorId]/route.ts      # Individual vendor operations
│   │   │   └── [vendorId]/templates/    # Vendor template management
│   │   ├── requests/
│   │   │   ├── route.ts                 # Create request, list with filtering (auth required)
│   │   │   ├── [requestId]/
│   │   │   │   ├── route.ts             # Get, update, delete request (auth + ownership)
│   │   │   │   ├── files/route.ts       # Add/remove invoices from request
│   │   │   │   ├── submit/route.ts      # Submit request for processing
│   │   │   │   ├── retry/route.ts       # Retry failed invoices
│   │   │   │   ├── stats/route.ts       # Get request statistics
│   │   │   │   ├── audit/route.ts       # Get request audit logs
│   │   │   │   └── timeline/route.ts    # Get request timeline
│   │   │   ├── bulk-delete/route.ts     # Bulk delete requests
│   │   │   └── bulk-export/route.ts     # Bulk export requests to JSON/CSV
│   │   ├── audit/route.ts       # Global audit log viewing (auth required)
│   │   └── export/
│   │       ├── route.ts                 # Generate Excel/CSV/JSON exports (auth required)
│   │       └── bulk/route.ts            # Bulk export for selected invoices (auth required)
│   ├── login/page.tsx           # Login/signup page with Google OAuth (client component)
│   ├── verify-email/page.tsx    # Email verification page
│   ├── forgot-password/page.tsx # Password reset request page
│   ├── reset-password/page.tsx  # Password reset confirmation page
│   ├── vendors/page.tsx         # Vendor management page
│   ├── requests/
│   │   ├── page.tsx             # Request list page with search, filters, bulk operations
│   │   └── [requestId]/page.tsx # Request detail page with tabs (Invoices, Timeline, Audit Trail)
│   ├── page.tsx                 # Main UI (client component, protected)
│   └── layout.tsx               # Root layout with SessionProvider
├── components/
│   ├── FileUpload.tsx           # Drag-and-drop PDF uploader (react-dropzone)
│   ├── FileProgressList.tsx     # Upload progress tracking for multiple files
│   ├── ProcessingProgress.tsx   # Real-time processing progress indicator
│   ├── InvoiceTable.tsx         # Data table with view/delete/retry actions, row selection
│   ├── InvoiceDetailDialog.tsx  # Full invoice detail modal with line items and errors
│   ├── InvoiceFilters.tsx       # Search and filter UI (status, currency, date, amount)
│   ├── BulkActionsToolbar.tsx   # Bulk operations toolbar (export, delete, retry)
│   ├── BulkVendorAssignment.tsx # Bulk vendor assignment UI
│   ├── ExportButtons.tsx        # Export action buttons
│   ├── header.tsx               # User info and sign out button
│   ├── session-provider.tsx     # NextAuth SessionProvider wrapper
│   ├── theme-provider.tsx       # next-themes provider wrapper
│   ├── theme-toggle.tsx         # Dark/light mode toggle button
│   ├── vendors/                 # Vendor management components
│   │   ├── VendorTable.tsx
│   │   ├── CreateVendorDialog.tsx
│   │   ├── VendorDetailDialog.tsx
│   │   └── TemplateEditor.tsx
│   ├── requests/                # Request management components
│   │   ├── RequestTable.tsx              # Request list table with selection
│   │   ├── RequestFilters.tsx            # Search and status filtering
│   │   ├── CreateRequestDialog.tsx       # Create new request dialog
│   │   ├── RequestStatusBadge.tsx        # Visual status indicators
│   │   ├── RequestDetailCard.tsx         # Request metadata card
│   │   ├── RequestStatistics.tsx         # Statistics dashboard with progress bars
│   │   ├── AuditTrail.tsx                # Detailed audit log viewer
│   │   └── RequestTimeline.tsx           # Visual event timeline
│   └── ui/                      # shadcn/ui components (button, dialog, skeleton, select, checkbox, etc.)
├── lib/
│   ├── auth.ts                  # NextAuth configuration (Credentials + Google OAuth, JWT)
│   ├── ai/
│   │   ├── extractor.ts         # OpenAI GPT-4o-mini extraction logic
│   │   ├── vendor-detector.ts   # Vendor detection from invoice text
│   │   ├── schema-builder.ts    # Dynamic schema generation for custom fields
│   │   └── field-mapper.ts      # Field mapping and validation
│   ├── pdf/parser.ts            # PDF text extraction (pdfreader)
│   ├── storage/                 # Storage abstraction layer (Strategy Pattern)
│   │   ├── storage-strategy.ts  # StorageStrategy interface definition
│   │   ├── local-storage.ts     # Local filesystem implementation
│   │   ├── s3-storage.ts        # AWS S3 implementation with presigned URLs
│   │   ├── s3-client.ts         # S3 client singleton
│   │   ├── storage-factory.ts   # Factory to select storage provider
│   │   └── index.ts             # Public exports
│   ├── export/                  # Excel, CSV, JSON generators
│   ├── email/                   # Email sending (nodemailer) and templates
│   ├── requests/                # Request management utilities
│   │   ├── status-calculator.ts # Request status calculation logic
│   │   └── statistics.ts        # Statistics calculation and formatting
│   ├── audit/                   # Audit logging system
│   │   ├── logger.ts            # Core audit logging functions
│   │   └── middleware.ts        # Request metadata extraction (IP, user agent)
│   └── db/prisma.ts             # Prisma client singleton
└── types/
    ├── invoice.ts               # Zod schemas + TypeScript types for invoices
    ├── vendor.ts                # Zod schemas + TypeScript types for vendors
    ├── request.ts               # Zod schemas + TypeScript types for requests
    └── audit.ts                 # Zod schemas + TypeScript types for audit logs
```

## Database Schema

### User Model (Authentication)
- Primary entity for user accounts
- `email`: Unique identifier for login
- `password`: Hashed with bcryptjs (10 rounds), nullable for OAuth-only accounts
- `emailVerified`: Timestamp of email verification (null until verified)
- One-to-many relationships: invoices, accounts (OAuth), sessions, vendors, uploadRequests, auditLogs
- All user data cascades on delete

### UploadRequest Model (Request Management)
- Groups invoice uploads into logical batches for workflow organization
- `title`: Request name (auto-generated like "Batch 2026-01-02 14:30" or user-provided)
- `status`: Request lifecycle state (draft, processing, completed, partial, failed)
- `defaultVendorId`: Optional vendor to apply to all invoices in request
- `autoProcess`: Flag for automatic processing when invoices are uploaded
- **Cached Statistics**: totalInvoices, processedCount, failedCount, pendingCount, queuedCount, processingCount, totalAmount, currency
- **Performance Metrics**: submittedAt, completedAt timestamps for analytics
- Indexes on `userId`, `status`, `createdAt`, `submittedAt` for efficient querying
- One-to-many relationships: invoices, auditLogs
- Deletion behavior: When deleted, invoices become "orphaned" (requestId set to null via onDelete: SetNull)

### AuditLog Model (Compliance & Debugging)
- Comprehensive audit trail for all system operations
- `eventType`: Specific action (request_created, invoice_uploaded, etc.)
- `eventCategory`: Grouping (request_lifecycle, invoice_operation, vendor_operation, user_action)
- `severity`: Event importance level (info, warning, error)
- `summary`: Human-readable description of the event
- `details`: JSON field with additional context
- **Change Tracking**: previousValue, newValue (JSON snapshots for before/after comparison)
- **Forensic Data**: ipAddress, userAgent for security and troubleshooting
- `targetType` and `targetId`: Links events to specific resources (request, invoice, vendor)
- Indexes on `requestId`, `userId`, `eventType`, `eventCategory`, `createdAt`, composite `(targetType, targetId)`
- Append-only design: No updates or deletes via API (cascade delete with request/user)

### Invoice Model
- Primary entity with one-to-many relationship to LineItem
- **User Isolation**: `userId` foreign key ensures each invoice belongs to one user
- **Request Association**: `requestId` links invoice to UploadRequest (nullable, onDelete: SetNull creates "orphaned" invoices)
- `status` field: "pending" → "processing" → "processed" or "failed"
- `rawText`: Full PDF text extracted by pdfreader
- `aiResponse`: Raw JSON response from OpenAI OR error details (stored as string)
- `fileUrl`: Can be local path (`/uploads/...`) or S3 URI (`s3://...`)
- **Vendor Integration**: `vendorId` links to vendor, `detectedVendorId` stores auto-detection result, `templateId` stores template used, `customData` stores custom field values
- **Background Job Tracking**: jobId (BullMQ), processingStartedAt, processingCompletedAt, retryCount, lastError
- Indexes on `userId`, `status`, `date`, `vendorId`, `jobId`, `requestId` for query performance

### LineItem Model
- Child entity linked via `invoiceId` (cascade delete enabled)
- `order`: Display sequence for line items
- All fields except `description` are nullable (some invoices lack detailed breakdowns)

### Vendor Model
- Stores vendor information for each user
- `identifiers`: JSON array of unique identifiers (Tax ID, Company Registration, etc.)
- One-to-many relationships: templates, invoices
- Indexes on `userId` and `name`

### VendorTemplate Model
- Stores custom extraction templates for vendors
- `customPrompt`: Additional AI instructions for this vendor
- `customFields`: JSON array of custom field definitions
- `fieldMappings`: JSON object mapping AI response fields to custom fields
- `validationRules`: JSON array of validation rules
- `isActive`: Only active templates are used for processing
- Tracks usage stats: `invoiceCount`, `lastUsedAt`

### Account & Session Models (NextAuth)
- Standard NextAuth schema for OAuth providers and JWT sessions
- Account: Stores OAuth provider tokens (Google, etc.)
- Session: JWT-based sessions (no database sessions used)

### VerificationToken Model
- Stores email verification tokens
- Unique `token` field with expiration timestamp
- Used for email verification after signup

### PasswordResetToken Model
- Stores password reset tokens
- Links to user via `email` field
- Unique `token` field with expiration timestamp
- Automatically cleaned up after use or expiration

## Environment Variables

Required in `.env.local`:
```env
# OpenAI Configuration (Required)
OPENAI_API_KEY=sk-...                                    # OpenAI API key (required for AI extraction)

# Database (Required)
# For PostgreSQL (Production):
DATABASE_URL="postgresql://user:password@localhost:5432/invoice_scanner?schema=public"
# For SQLite (Development only):
# DATABASE_URL="file:./dev.db"
NODE_ENV=development

# NextAuth (Required)
AUTH_SECRET=<generated-secret>                           # NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000                       # Base URL for callbacks

# Google OAuth (Optional - for Google sign-in)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Email/SMTP (Optional - for email verification and password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_NAME="Invoice Scanner"
SMTP_FROM_EMAIL=your_email@gmail.com

# AWS S3 Cloud Storage (Optional - for production file storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_S3_BUCKET_NAME=invoice-scanner-files
S3_PRESIGNED_URL_EXPIRY=3600                     # Presigned URL expiration in seconds (default: 1 hour)
STORAGE_PROVIDER=s3                              # Use 's3' for cloud storage, 'local' for filesystem
```

**Important**: After adding/changing `.env.local`, restart the dev server.

### Generating AUTH_SECRET
```bash
openssl rand -base64 32
```

### Google OAuth Setup (Optional)
To enable "Sign in with Google":
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing one
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen if needed
6. Application type: "Web application"
7. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
8. Copy the Client ID and Client Secret to `.env.local`

### Email/SMTP Configuration (Optional)
For email verification and password reset functionality:
- **Gmail**: Use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password
- **Other providers**: Use your SMTP server credentials
- **Development**: If SMTP is not configured, emails will be logged to console instead of sent
- Email features gracefully degrade when SMTP is not configured

### AWS S3 Cloud Storage Setup (Optional)
For production file storage instead of local filesystem:
1. Go to [AWS Console → S3](https://console.aws.amazon.com/s3) and create bucket
2. Bucket settings: Block all public access ✅, Server-side encryption (AES256) ✅
3. Go to [AWS Console → IAM](https://console.aws.amazon.com/iam) and create user with programmatic access
4. Attach custom policy with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:HeadObject`, `s3:ListBucket` permissions
5. Add AWS credentials to `.env.local` (see above)
6. Set `STORAGE_PROVIDER=s3` to enable S3 storage
7. **Migration**: Existing local files continue working; new uploads go to S3
8. See `.env.example` for detailed AWS configuration and IAM policy example

## AI Extraction Logic

### OpenAI Configuration
- Model: `gpt-4o-mini` (src/lib/ai/extractor.ts:93) - Cost-effective choice, ~60-80% cheaper than GPT-4 Turbo
- Uses `response_format: { type: "json_object" }` to enforce JSON responses
- Temperature: 0.1 for consistent, deterministic extraction
- Zod validation ensures type safety before database insertion

### Vendor Detection
Three-strategy approach for automatic vendor detection:
1. **Identifier Matching** (fast, free): Matches Tax IDs, Company Registration numbers
2. **AI Detection** (accurate, low cost): Uses GPT-4o-mini to analyze invoice text
3. **Fuzzy Matching** (fallback): Partial string matching on vendor name

### Vendor Templates
Templates allow per-vendor customization:
- **Custom Prompts**: Additional instructions for AI extraction
- **Custom Fields**: Define vendor-specific fields beyond standard invoice fields
- **Field Mappings**: Map AI response fields to database fields
- **Validation Rules**: Enforce business rules (min/max values, required fields, etc.)

### Extraction Prompt Structure
The prompt (src/lib/ai/extractor.ts:10-40) instructs GPT-4 to:
- Return JSON with fields: invoiceNumber, date (ISO 8601), totalAmount, currency, lineItems
- Use `null` for missing fields (not empty strings)
- Parse amounts as numbers without currency symbols
- Extract all line items with description/quantity/unitPrice/amount
- If vendor template exists, include custom fields and follow custom prompt instructions

### Fallback Strategy
`extractInvoiceDataWithFallback()` is a stub for future GPT-4 Vision integration to handle scanned/image-based PDFs. Currently, it just calls text extraction.

## Path Aliases

The project uses TypeScript path aliases:
- `@/*` → `./src/*`

Example: `import { prisma } from "@/lib/db/prisma"`

## Common Development Patterns

### Working with File Storage

**To upload a file**:
```typescript
import { StorageFactory } from "@/lib/storage";

const storage = StorageFactory.getStorage();
const fileUrl = await storage.upload(file, userId);
// fileUrl will be "/uploads/..." for local or "s3://bucket/..." for S3
```

**To download a file**:
```typescript
import { StorageFactory } from "@/lib/storage";

const storage = StorageFactory.getStorage(invoice.fileUrl);
const buffer = await storage.download(invoice.fileUrl);
// For S3 files, use getUrl() to get presigned URL instead:
const url = await storage.getUrl(invoice.fileUrl);
```

**To delete a file**:
```typescript
import { StorageFactory } from "@/lib/storage";

const storage = StorageFactory.getStorage(invoice.fileUrl);
await storage.delete(invoice.fileUrl);
```

**Storage factory automatically selects the correct provider** based on:
1. File URL prefix (local: `/uploads/...`, S3: `s3://...`)
2. `STORAGE_PROVIDER` environment variable for new uploads

### Adding a New Export Format
1. Create `src/lib/export/newformat.ts` with a function that takes invoices and returns a file buffer
2. Add the format to `ExportOptions.format` union type in `src/types/invoice.ts`
3. Update `src/app/api/export/route.ts` to handle the new format in the switch statement
4. Add a button to `src/components/ExportButtons.tsx`

### Modifying AI Extraction Schema
1. Update Zod schemas in `src/types/invoice.ts` (ExtractedInvoiceSchema or LineItemSchema)
2. Update the prompt in `src/lib/ai/extractor.ts` (EXTRACTION_PROMPT) to match new schema
3. Update database schema in `prisma/schema.prisma` if adding persistent fields
4. Run `npx prisma migrate dev --name descriptive_name` to create and apply migration
5. Prisma client regenerates automatically after migration

### Adding Authentication to a New API Route
1. Import `auth` from `@/lib/auth`
2. Call `const session = await auth()` at the start of the route handler
3. Return 401 if `!session?.user?.id`
4. Filter database queries by `userId: session.user.id`
5. Verify ownership before modifying resources (return 403 if not owner)

### Working with Prisma

**Database Configuration**:
- **Production**: PostgreSQL (recommended for production deployments)
- **Development**: SQLite or PostgreSQL (switch provider in `prisma/schema.prisma`)

**PostgreSQL Connection String Format**:
```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA
```

After schema changes in `prisma/schema.prisma`:
```bash
npx prisma migrate dev --name descriptive_name  # Creates migration + applies it
npx prisma generate                              # Regenerates TypeScript types
```

**Setting up a new PostgreSQL database**:
```bash
# First, ensure your DATABASE_URL is set in both .env and .env.local
# Format: postgresql://user:password@localhost:5432/database_name?schema=public

# Generate Prisma client
npx prisma generate

# Option 1: Create migrations (requires CREATEDB permission for shadow database)
npx prisma migrate dev --name init

# Option 2: Push schema without migrations (recommended if no CREATEDB permission)
npx prisma db push

# Verify setup
psql -U your_user -d your_database -c "\dt"  # List all tables
```

Include related data in queries:
```typescript
await prisma.invoice.findMany({
  include: { lineItems: true }  // Joins LineItem records
})
```

## File Upload Handling

**Storage Strategy Pattern**:
- Files saved via `StorageFactory.getStorage()` which selects provider (local or S3)
- Local files: Saved to `public/uploads/`, `fileUrl` stores relative path: `/uploads/filename.pdf`
- S3 files: Saved to `users/{userId}/invoices/{filename}`, `fileUrl` stores S3 URI: `s3://bucket/users/{userId}/invoices/filename.pdf`
- Max file size: 10MB (validated in client and can be enforced server-side)
- File validation: Must be `application/pdf` MIME type

**Downloading Files**:
- Local files: Direct access via public URL
- S3 files: Use `/api/invoices/download?id={invoiceId}` to get presigned URL (1-hour expiry)
- Storage factory automatically determines correct download method based on file URL prefix

## API Security and Data Isolation

All API routes enforce authentication and user data isolation:

- **Authentication Check**: Each protected route calls `const session = await auth()` and returns 401 if `!session?.user?.id`
- **User Data Filtering**: Database queries filter by `userId: session.user.id` to ensure users only see their own data
- **Ownership Verification**: Before modifying/deleting resources, routes verify `resource.userId === session.user.id` (returns 403 if not owner)
- **Password Security**: Passwords hashed with bcrypt (10 rounds), never stored in plain text

### Example: Protected API Route Pattern
```typescript
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // 1. Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Filter data by user
  const invoices = await prisma.invoice.findMany({
    where: { userId: session.user.id }
  });

  return NextResponse.json({ invoices });
}
```

## Known Limitations

1. **Scanned PDFs**: Text-based extraction only. Scanned/image PDFs with poor OCR will fail. GPT-4 Vision integration is planned but not implemented.
2. **No Background Jobs**: Processing is synchronous. Large PDFs may timeout. Consider implementing job queue (Bull/BullMQ with Redis) for production.
3. **No Automated Tests**: Test suite not yet implemented. Consider adding Jest or Vitest for unit/integration tests.

## Cost Management

Each AI processing call uses `gpt-4o-mini` which is highly cost-effective:
- **Typical cost**: ~$0.001-0.005 per invoice (60-80% cheaper than GPT-4 Turbo)
- **Pricing**: $0.150 per 1M input tokens, $0.600 per 1M output tokens
- Processed invoices are cached in the database (don't reprocess)
- Monitor usage at platform.openai.com

### Cost Comparison
- **GPT-4o-mini** (current): ~$0.001-0.005 per invoice ✅
- **GPT-4 Turbo**: ~$0.01-0.05 per invoice
- **GPT-4**: ~$0.03-0.15 per invoice

## UI Features

### Dark Mode
- Implemented using `next-themes` with system theme detection
- ThemeProvider wraps the entire app in `src/app/layout.tsx`
- Theme toggle button in top-right corner (`theme-toggle.tsx`)
- Preference persists in localStorage
- CSS variables in `globals.css` handle theme colors

### Loading States
- Skeleton loaders display while data is being fetched (`skeleton.tsx`)
- InvoiceTable shows 5 animated skeleton rows during initial load
- `loadingInvoices` state in main page tracks fetch status
- Prevents blank states and improves perceived performance

### Invoice Detail View
- Modal dialog (`InvoiceDetailDialog.tsx`) shows complete invoice information
- Click eye icon in table Actions column to open
- Displays: basic info, line items table, raw PDF text, AI response JSON, metadata
- Scrollable content for long invoices
- Uses Radix UI Dialog for accessibility

### Delete Functionality
- Trash icon in table Actions column
- Confirmation dialog before deletion (`alert-dialog.tsx`)
- Deletes both database record AND physical PDF file
- Ownership verification ensures users can only delete their own invoices
- Automatically refreshes table after deletion

### Advanced Filtering & Search
- Search bar filters by invoice number, file name, or line item descriptions
- Status filter: all, pending, processing, processed, failed
- Currency filter: all, USD, EUR, GBP, etc.
- Date range filter: from/to dates
- Amount range filter: min/max amounts
- Pagination: 10 invoices per page with page navigation
- Filters reset to page 1 when changed
- Shows filtered count vs total count

### Bulk Operations
- Row selection with checkboxes in table header and each row
- Select all/deselect all functionality
- Bulk actions toolbar appears when invoices are selected
- **Bulk Export**: Export only selected invoices to Excel/CSV/JSON
- **Bulk Delete**: Delete multiple invoices at once (with confirmation dialog)
- **Bulk Retry**: Retry processing for selected failed invoices
- **Bulk Vendor Assignment**: Assign vendor to multiple invoices
- Selection persists across filter changes but resets on page change

### Error Handling & Retry
- Failed invoices show alert icon with error details
- Error messages stored in `aiResponse` field with timestamp
- Click eye icon to view full error details in modal
- Retry button (↻ icon) re-processes failed invoices
- Retry clears previous line items and resets status to "processing"
- Loading spinner shows during retry operation

### Vendor Management
- Dedicated vendor management page (`/vendors`)
- Create vendors with identifiers (Tax ID, Company Registration, etc.)
- Create custom templates with:
  - Custom AI prompts
  - Custom field definitions
  - Field mappings
  - Validation rules
- Automatic vendor detection during processing
- Manual vendor assignment via bulk operations
- Template usage statistics tracking

## Recent Improvements

1. **AWS S3 Cloud Storage Integration** (2025-12-31):
   - Implemented Storage Strategy Pattern for flexible file storage
   - AWS S3 cloud storage with presigned URLs for secure downloads
   - Hybrid local/S3 support for zero-downtime migration
   - User-isolated storage structure (`users/{userId}/invoices/`)
   - Server-side AES256 encryption
   - Orphaned file cleanup API (`/api/admin/cleanup-orphaned-files`)
   - Storage abstraction: `StorageStrategy` interface with `LocalStorage` and `S3Storage` implementations
2. **PostgreSQL Database Migration** (2025-12-30):
   - Migrated from SQLite to PostgreSQL for production scalability
   - Added optimized @db.Text annotations for large text fields
   - SQLite still supported for local development
   - Created comprehensive migration guide (see MIGRATION_GUIDE.md)
3. **Multi-Provider Authentication**:
   - Email/password authentication with bcrypt
   - Google OAuth sign-in with account linking
   - Email verification flow with token-based validation
   - Password reset functionality via email
4. **Vendor Management System**:
   - Vendor profiles with identifiers for auto-detection
   - Custom extraction templates per vendor
   - Three-strategy vendor detection (identifier, AI, fuzzy)
   - Field mapping and validation rules
5. **Bulk Operations**:
   - Row selection with checkboxes
   - Bulk export (Excel/CSV/JSON) for selected invoices
   - Bulk delete with confirmation
   - Bulk retry for failed processing
   - Bulk vendor assignment
6. **Advanced Filtering**: Search, status/currency/date/amount filters, pagination
7. **Error Handling**: Detailed error messages, retry functionality for failed invoices
8. **Model Change** (Cost Optimization): Switched from `gpt-4-turbo-preview` to `gpt-4o-mini` for 60-80% cost reduction
9. **Dark Mode**: Full theme support with toggle and persistence
10. **Loading States**: Skeleton loaders and progress indicators improve UX
11. **Invoice Details**: Comprehensive view modal with all invoice data and error details
