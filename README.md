# Invoice Scanner - AI-Powered PDF Processing

A Next.js web application that uses OpenAI GPT-4 to extract structured data from invoice and receipt PDFs, with export functionality to Excel, CSV, and JSON formats.

## Features

- **Multi-User Authentication**: Secure user authentication system with:
  - Email/password registration and login
  - Google OAuth sign-in
  - Microsoft Azure AD sign-in
  - Apple Sign-In
  - Email verification
  - Password reset flow
  - Account linking support
- **Request Management System**: Organize invoices into logical batches with:
  - Create named requests to group related invoices
  - Upload multiple files during request creation or add later
  - Track request lifecycle (draft → processing → completed/partial/failed)
  - Real-time statistics (total invoices, processed, failed, pending)
  - Submit entire batches for processing with one click
  - Comprehensive audit trail for compliance and debugging
  - Timeline view showing all request events
- **Background Job Processing**: Asynchronous invoice processing with:
  - BullMQ job queue with Redis for reliable processing
  - Real-time status updates via polling (queued → processing → processed)
  - Automatic retry with exponential backoff
  - Dedicated worker process for scalability
  - Graceful fallback to synchronous mode
  - Support for serverless and self-hosted deployments
  - Request statistics update automatically during processing
- **Cloud Storage Integration**: Production-ready file storage with:
  - AWS S3 cloud storage with presigned URLs
  - Hybrid local/S3 support for zero-downtime migration
  - User-isolated storage structure (`users/{userId}/invoices/`)
  - Server-side AES256 encryption
  - PDF download feature with time-limited secure URLs
  - Orphaned file cleanup automation
- **Batch PDF Upload**: Drag-and-drop interface for uploading multiple PDF files
- **AI-Powered Extraction**: Uses OpenAI GPT-4o-mini to extract:
  - Invoice/Receipt number
  - Date
  - Line item descriptions
  - Total amount
  - Currency
- **Vendor Management**: Intelligent vendor detection and custom templates:
  - Automatic vendor detection from invoice text
  - Custom extraction templates per vendor
  - Field mappings and validation rules
  - Three-strategy detection (identifier, AI, fuzzy matching)
- **Bulk Operations**: Select multiple invoices for:
  - Bulk delete
  - Bulk export
  - Bulk retry (for failed processes)
  - Bulk vendor assignment
- **Data Display**: Interactive table with sorting, filtering, and pagination
- **Multiple Export Formats**: Export processed data to Excel (.xlsx), CSV, or JSON
- **Persistent Storage**: PostgreSQL database with user isolation and scalability
- **Responsive UI**: Modern, clean interface with dark mode support

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Authentication**: NextAuth.js v5 with multiple OAuth providers (Google, Microsoft, Apple)
- **Database**: PostgreSQL with Prisma ORM (SQLite supported for local development)
- **Background Jobs**: BullMQ with Redis for asynchronous processing
- **Cloud Storage**: AWS S3 with presigned URLs (local filesystem fallback)
- **AI**: OpenAI GPT-4o-mini API
- **PDF Processing**: pdfreader
- **Email**: Nodemailer (SMTP)
- **UI Components**: shadcn/ui, Tailwind CSS, Radix UI
- **Table**: TanStack React Table
- **File Upload**: react-dropzone

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 12+ installed and running
- Redis 6+ installed and running (for background job processing)
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- (Optional) AWS Account with S3 access for cloud storage
- (Optional) Google OAuth credentials for Google sign-in
- (Optional) Microsoft Azure AD credentials for Microsoft sign-in
- (Optional) Apple Developer account for Apple Sign-In
- (Optional) SMTP server credentials for email features

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and configure your settings:

```bash
cp .env.example .env.local
```

Edit the `.env.local` file with your configuration:

```env
# OpenAI Configuration (Required)
OPENAI_API_KEY=your_openai_api_key_here

# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/invoice_scanner?schema=public"
# For local development with SQLite (alternative):
# DATABASE_URL="file:./dev.db"
NODE_ENV=development

# NextAuth (Required)
AUTH_SECRET=your_generated_secret_here  # Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# AWS S3 Cloud Storage (Optional - for production)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_S3_BUCKET_NAME=invoice-scanner-files
STORAGE_PROVIDER=s3  # Use 's3' for cloud storage, 'local' for filesystem

# Google OAuth (Optional - for Google sign-in)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Microsoft Azure AD OAuth (Optional - for Microsoft sign-in)
AZURE_AD_CLIENT_ID=your_application_client_id_here
AZURE_AD_CLIENT_SECRET=your_client_secret_value_here
AZURE_AD_TENANT_ID=common

# Apple Sign-In (Optional - for Apple sign-in)
APPLE_ID=com.yourdomain.invoice-scanner.signin
APPLE_TEAM_ID=your_team_id_here
APPLE_KEY_ID=your_key_id_here
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_private_key_content_here\n-----END PRIVATE KEY-----"

# Email/SMTP (Optional - for email verification and password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_NAME="Invoice Scanner"
SMTP_FROM_EMAIL=your_email@gmail.com

# Redis Configuration (Required for background jobs)
REDIS_URL=redis://localhost:6379

# Background Job Configuration
WORKER_MODE=separate              # 'separate', 'embedded', or 'disabled'
QUEUE_NAME=invoice-processing     # Job queue name
JOB_ATTEMPTS=3                    # Max retry attempts
JOB_BACKOFF_TYPE=exponential      # Backoff strategy
JOB_BACKOFF_DELAY=5000           # Initial delay in ms
JOB_TIMEOUT=120000               # Job timeout (2 minutes)
WORKER_CONCURRENCY=5              # Concurrent jobs per worker
NEXT_PUBLIC_POLLING_INTERVAL=10000  # Frontend polling interval (10 seconds)
```

**Required Configuration**:
1. **OpenAI API Key**: Get from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. **AUTH_SECRET**: Generate with `openssl rand -base64 32`

**Optional: Google OAuth Setup** (for "Sign in with Google"):
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

**Optional: Microsoft Azure AD Setup** (for "Sign in with Microsoft"):
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "Azure Active Directory" → "App registrations" → "New registration"
3. Configure application:
   - **Name**: "Invoice Scanner" (or your choice)
   - **Supported account types**: "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI** (Web):
     - Development: `http://localhost:3000/api/auth/callback/azure-ad`
     - Production: `https://yourdomain.com/api/auth/callback/azure-ad`
4. Click "Register"
5. Copy the **Application (client) ID** → `AZURE_AD_CLIENT_ID` in `.env.local`
6. Go to "Certificates & secrets" → "Client secrets" → "New client secret"
   - **Description**: "NextAuth.js Secret"
   - **Expires**: 24 months (or your preference)
   - Click "Add"
   - **IMPORTANT**: Copy the secret **VALUE** immediately (you won't see it again!)
   - Paste into `AZURE_AD_CLIENT_SECRET` in `.env.local`
7. Go to "Overview" page → Copy **Directory (tenant) ID** → `AZURE_AD_TENANT_ID` in `.env.local`
   - **Tip**: Use `common` for multi-tenant support (allows both personal and work accounts)
8. Optional: Configure API permissions (default User.Read is sufficient)

**Optional: Apple Sign-In Setup** (for "Sign in with Apple"):

**Prerequisites**: Active Apple Developer account ($99/year)

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to "Certificates, Identifiers & Profiles"

3. **Create App ID**:
   - Identifiers → **+** button → App IDs → Continue
   - **Description**: "Invoice Scanner Web"
   - **Bundle ID**: `com.yourdomain.invoice-scanner` (use reverse domain notation)
   - **Capabilities**: Check "Sign in with Apple"
   - Click "Continue" → "Register"

4. **Create Services ID**:
   - Identifiers → **+** button → Services IDs → Continue
   - **Description**: "Invoice Scanner Sign In"
   - **Identifier**: `com.yourdomain.invoice-scanner.signin` → This becomes `APPLE_ID`
   - Click "Continue" → "Register"

5. **Configure Services ID**:
   - Click on the Services ID you just created
   - Check "Sign in with Apple"
   - Click "Configure" next to "Sign in with Apple"
   - **Primary App ID**: Select the App ID created in step 3
   - **Web Domain**: `yourdomain.com` (production domain, no http/https)
   - **Return URLs**:
     - Development: `http://localhost:3000/api/auth/callback/apple`
     - Production: `https://yourdomain.com/api/auth/callback/apple`
   - Click "Save" → "Continue" → "Register"

6. **Create Private Key**:
   - Keys → **+** button
   - **Key Name**: "Invoice Scanner Sign In Key"
   - Check "Sign in with Apple"
   - Click "Configure" → Select your App ID → Save
   - Click "Continue" → "Register"
   - **Download the key file** (AuthKey_XXXXXXXXXX.p8)
   - **IMPORTANT**: You can only download this once! Keep it secure.
   - Copy the **Key ID** (10 characters) → `APPLE_KEY_ID` in `.env.local`

7. **Get Team ID**:
   - Go to "Membership" in your developer account
   - Copy your **Team ID** (10 characters) → `APPLE_TEAM_ID` in `.env.local`

8. **Configure Private Key Environment Variable**:
   - Open the downloaded .p8 file in a text editor
   - Copy the entire content
   - Replace newlines with `\n` literal string
   - Paste into `APPLE_PRIVATE_KEY` in `.env.local` (keep the quotes)
   - Example format: `"-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"`

**Optional: Email Configuration** (for verification emails and password reset):
- For Gmail: Use an [App Password](https://support.google.com/accounts/answer/185833)
- For other providers: Use your SMTP server credentials
- Leave empty for development (emails will be logged to console)

**Optional: AWS S3 Cloud Storage Setup** (for production file storage):

By default, files are stored locally in `public/uploads/`. For production deployments, use AWS S3:

1. **Create S3 Bucket**:
   - Go to [AWS Console → S3](https://console.aws.amazon.com/s3)
   - Click "Create bucket"
   - Bucket name: `invoice-scanner-files` (or your choice)
   - Region: `us-east-1` (or your preferred region)
   - **Block all public access**: ✅ ENABLED
   - **Versioning**: Optional
   - **Server-side encryption**: AES256 ✅ ENABLED

2. **Create IAM User**:
   - Go to [AWS Console → IAM → Users](https://console.aws.amazon.com/iam/home#/users)
   - Click "Create user"
   - User name: `invoice-scanner-s3-user`
   - Access type: Programmatic access
   - Create and attach custom policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": [
         "s3:PutObject",
         "s3:GetObject",
         "s3:DeleteObject",
         "s3:HeadObject",
         "s3:ListBucket"
       ],
       "Resource": [
         "arn:aws:s3:::invoice-scanner-files",
         "arn:aws:s3:::invoice-scanner-files/*"
       ]
     }]
   }
   ```
   - Save **Access Key ID** and **Secret Access Key** (you won't see them again!)

3. **Configure Environment Variables**:
   - Add AWS credentials to `.env.local` (see above)
   - Set `STORAGE_PROVIDER=s3` to enable S3 storage

4. **Optional: Configure S3 Lifecycle Rules** (for automatic file management):
   - Go to S3 bucket → Management → Lifecycle rules
   - **Rule 1**: Archive to Glacier after 90 days
   - **Rule 2**: Delete files after 365 days
   - **Rule 3**: Cleanup incomplete uploads after 7 days

**Storage Behavior**:
- **Without AWS configuration**: Files stored in `public/uploads/` (local filesystem)
- **With AWS configuration**: New uploads go to S3, existing local files continue working
- **Hybrid support**: System supports both local and S3 files transparently
- **Cost**: ~$0.02/month for 100 invoices, scales to ~$20/month for 10,000 invoices

See `.env.example` for detailed AWS configuration documentation.

### 3. Setup Database

**PostgreSQL Setup** (recommended for production):

1. Create a PostgreSQL database:
```bash
psql -U postgres -c "CREATE DATABASE invoice_scanner;"
```

2. Update `DATABASE_URL` in `.env.local` with your PostgreSQL credentials

3. Initialize the database schema:
```bash
npx prisma generate
npx prisma db push
# Or use migrations if you have CREATEDB permission:
# npx prisma migrate dev --name init
```

**Alternative: SQLite for Development**:
- Set `DATABASE_URL="file:./dev.db"` in `.env.local`
- Change `provider = "postgresql"` to `provider = "sqlite"` in `prisma/schema.prisma`
- Run `npx prisma generate && npx prisma db push`

### 4. Setup Redis

Redis is required for background job processing. Choose one of these options:

**Option A: Docker (Recommended for Development)**:
```bash
docker run -d -p 6379:6379 --name invoice-scanner-redis redis:7-alpine
```

**Option B: Native Installation**:
```bash
# macOS
brew install redis
redis-server

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Verify Redis is running
redis-cli ping  # Should return "PONG"
```

**Option C: Cloud Redis (Production)**:
- **Upstash** (serverless, free tier): https://upstash.com
- **Redis Cloud** (managed): https://redis.com/cloud
- Update `REDIS_URL` in `.env.local` with the connection string

### 5. Run Development Server

You can run the Next.js app and worker process together or separately:

**Option A: Run both together (recommended)**:
```bash
npm run dev:all
```

**Option B: Run separately (in two terminals)**:
```bash
# Terminal 1: Next.js development server
npm run dev

# Terminal 2: Worker process
npm run worker:dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Authentication

The application supports multiple authentication methods:

1. **Email/Password**:
   - Sign up with email, name, and password
   - Receive verification email (if SMTP configured)
   - Log in with credentials
   - Use "Forgot password?" to reset password

2. **Google Sign-In**:
   - Click "Sign in with Google" on the login page
   - Automatically creates account on first sign-in
   - Email is pre-verified for Google accounts
   - Can link existing email account to Google

3. **Microsoft Sign-In**:
   - Click "Sign in with Microsoft" on the login page
   - Supports both personal Microsoft accounts and organizational accounts
   - Automatically creates account on first sign-in
   - Can link existing email account to Microsoft

4. **Apple Sign-In**:
   - Click "Sign in with Apple" on the login page
   - Automatically creates account on first sign-in
   - Can link existing email account to Apple
   - Requires Apple Developer account to configure

**Account Linking**: All OAuth providers support account linking. If you sign in with Google/Microsoft/Apple using an email that already exists in the system, it will automatically link to your existing account.

### Request Management (Batch Processing)

The request system allows you to organize invoices into named batches for better tracking and compliance:

1. **Create Request with Files**:
   - Click "Create Request" button on the Requests page
   - Enter a title (e.g., "December 2025 Expenses") or leave blank for auto-generated name
   - Add optional description for notes
   - Drag & drop PDF files directly into the dialog
   - Click "Create & Upload" to create request and upload files in one step

2. **Add Files to Existing Request**:
   - Navigate to request detail page
   - Click "Add Files" button (only available for draft requests)
   - Upload additional PDFs to the request

3. **Submit Request for Processing**:
   - Click "Submit" button on request detail page
   - All pending invoices in the request are queued for processing
   - Watch real-time statistics update as invoices process
   - Request status transitions: draft → processing → completed/partial/failed

4. **Monitor Progress**:
   - **Invoices Tab**: View all invoices in the request with processing status
   - **Timeline Tab**: See chronological events (upload, processing, completion)
   - **Audit Trail Tab**: View detailed audit logs for compliance

5. **Request Lifecycle**:
   - **Draft**: Invoices can be added/removed, request can be edited
   - **Processing**: At least one invoice is being processed
   - **Completed**: All invoices successfully processed
   - **Partial**: Some invoices processed, some failed (intervention needed)
   - **Failed**: All invoices failed processing

### Direct Upload (Without Request)

For quick one-off uploads, you can use the main upload page:

1. **Upload PDFs**:
   - Drag and drop PDF files into the upload area, or click to select files
   - Supports multiple files at once (max 10MB per file)
   - These invoices are created without a request (orphaned)

2. **Process with AI**:
   - Click "Process with AI" button after uploading
   - Jobs are queued for background processing (status: **queued**)
   - Worker process picks up jobs and begins processing (status: **processing**)
   - Processing typically takes 7-30 seconds per document
   - Status updates automatically every 10-20 seconds via polling

3. **View Results**:
   - Processed invoices appear in the table below
   - View invoice number, date, descriptions, and total amount
   - Enhanced status badges:
     - **Pending** (gray): Uploaded but not yet queued
     - **Queued** (blue): Waiting for worker to pick up job
     - **Processing** (yellow, animated): Currently being processed by AI
     - **Processed** (green): Successfully completed
     - **Validation Failed** (orange): Processed but failed validation rules
     - **Failed** (red): Processing error occurred
   - Click the eye icon to view full invoice details including errors

### Exporting Data

Click one of the export buttons to download all processed invoices:

- **Export Excel**: Creates a multi-sheet .xlsx file with summary and line items
- **Export CSV**: Creates a CSV file with invoice summaries
- **Export JSON**: Creates a JSON file with complete invoice data

### Bulk Operations

Select multiple invoices using checkboxes to perform bulk actions:

1. **Select Invoices**:
   - Check individual invoices or use "Select all" checkbox in header
   - Bulk actions toolbar appears when invoices are selected

2. **Available Actions**:
   - **Export Selected**: Export only the selected invoices
   - **Delete Selected**: Delete multiple invoices at once (with confirmation)
   - **Retry Failed**: Retry processing for selected failed invoices
   - **Clear Selection**: Deselect all invoices

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── upload/        # File upload endpoint
│   │   │   ├── process/       # Job dispatcher & legacy processor
│   │   │   ├── invoices/      # Invoice CRUD, download & status
│   │   │   ├── requests/      # Request management CRUD & workflow
│   │   │   ├── audit/         # Audit log endpoints
│   │   │   ├── export/        # Export endpoints
│   │   │   ├── vendors/       # Vendor management
│   │   │   └── admin/         # Admin utilities (cleanup)
│   │   ├── requests/          # Request pages
│   │   │   ├── page.tsx      # Request list page
│   │   │   └── [requestId]/  # Request detail page
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main page
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── requests/         # Request management UI
│   │   │   ├── CreateRequestDialog.tsx
│   │   │   ├── AddFilesDialog.tsx
│   │   │   ├── RequestTable.tsx
│   │   │   ├── RequestDetailCard.tsx
│   │   │   ├── RequestStatistics.tsx
│   │   │   ├── RequestTimeline.tsx
│   │   │   └── AuditTrail.tsx
│   │   ├── vendors/          # Vendor management UI
│   │   ├── FileUpload.tsx    # Upload component
│   │   ├── InvoiceTable.tsx  # Table component
│   │   └── ExportButtons.tsx # Export component
│   ├── hooks/                # React hooks
│   │   └── useInvoicePolling.ts  # Status polling hook
│   ├── lib/                  # Utility libraries
│   │   ├── ai/              # AI extraction logic
│   │   ├── pdf/             # PDF parsing
│   │   ├── storage/         # Cloud storage abstraction
│   │   ├── queue/           # BullMQ queue management
│   │   ├── requests/        # Request statistics & status
│   │   ├── audit/           # Audit logging system
│   │   ├── export/          # Export functionality
│   │   ├── db/              # Prisma client
│   │   └── utils.ts         # Helper functions
│   ├── workers/             # Background worker processes
│   │   ├── invoice-processor.ts  # BullMQ worker
│   │   └── processor-logic.ts    # Core processing logic
│   └── types/               # TypeScript types
├── prisma/
│   └── schema.prisma        # Database schema
├── tsconfig.worker.json     # Worker TypeScript config
└── public/
    └── uploads/             # Local PDF storage (fallback)
```

## Database Schema

**UploadRequest Model** (NEW):
- `id`: Unique identifier
- `userId`: User who created the request
- `title`: Request name (auto-generated or user-provided)
- `description`: Optional notes
- `status`: Lifecycle status (draft/processing/completed/partial/failed)
- `defaultVendorId`: Optional default vendor for all invoices
- `autoProcess`: Whether to auto-process on upload
- `totalInvoices`: Cached count of total invoices
- `processedCount`: Count of successfully processed invoices
- `failedCount`: Count of failed invoices
- `pendingCount`: Count of pending invoices
- `queuedCount`: Count of queued invoices
- `processingCount`: Count of currently processing invoices
- `totalAmount`: Sum of all invoice amounts
- `currency`: Currency code
- `submittedAt`: When request was submitted for processing
- `completedAt`: When all processing finished
- `invoices`: Related invoices
- `auditLogs`: Related audit events

**Invoice Model**:
- `id`: Unique identifier
- `userId`: User who uploaded the invoice
- `fileName`: Original file name
- `fileUrl`: Storage path
- `requestId`: Optional foreign key to UploadRequest
- `invoiceNumber`: Extracted invoice number
- `date`: Extracted date
- `totalAmount`: Total amount
- `currency`: Currency code
- `status`: Processing status (pending/queued/processing/processed/validation_failed/failed)
- `rawText`: Extracted PDF text
- `aiResponse`: Full AI response
- `jobId`: BullMQ job identifier
- `processingStartedAt`: When processing began
- `processingCompletedAt`: When processing finished
- `retryCount`: Number of retry attempts
- `lastError`: Last error message
- `vendorId`: Associated vendor
- `detectedVendorId`: Auto-detected vendor
- `templateId`: Applied vendor template
- `customData`: Custom field values
- `lineItems`: Related line items

**AuditLog Model** (NEW):
- `id`: Unique identifier
- `requestId`: Optional foreign key to UploadRequest
- `userId`: User who triggered the event
- `eventType`: Event identifier (request_created, invoice_uploaded, etc.)
- `eventCategory`: Category (request_lifecycle, invoice_operation, vendor_operation, user_action)
- `severity`: Log level (info/warning/error)
- `summary`: Human-readable description
- `details`: JSON details object
- `targetType`: Resource type (request/invoice/vendor)
- `targetId`: Resource identifier
- `previousValue`: Before state (JSON snapshot)
- `newValue`: After state (JSON snapshot)
- `ipAddress`: Client IP address
- `userAgent`: Client user agent
- `metadata`: Additional metadata
- `createdAt`: Event timestamp

**LineItem Model**:
- `id`: Unique identifier
- `invoiceId`: Foreign key to Invoice
- `description`: Item description
- `quantity`: Item quantity
- `unitPrice`: Price per unit
- `amount`: Line item total
- `order`: Display order

## API Endpoints

### Authentication
- `POST /api/signup` - Create new user account
- `POST /api/auth/signin` - Sign in with credentials
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/callback/google` - Google OAuth callback
- `GET /api/auth/callback/azure-ad` - Microsoft Azure AD OAuth callback
- `GET /api/auth/callback/apple` - Apple Sign-In callback
- `POST /api/forgot-password` - Request password reset
- `POST /api/reset-password` - Reset password with token
- `GET /api/verify-email` - Verify email with token

### Request Management (NEW)
- `POST /api/requests` - Create new request
- `GET /api/requests` - List user's requests with pagination/filters
- `GET /api/requests/{id}` - Get request details with invoices
- `PATCH /api/requests/{id}` - Update request metadata
- `DELETE /api/requests/{id}` - Delete request (invoices become orphaned)
- `POST /api/requests/{id}/submit` - Submit request for processing
- `POST /api/requests/{id}/retry` - Retry failed invoices in request
- `POST /api/requests/{id}/files` - Add files to request (deprecated - use /api/upload)
- `GET /api/requests/{id}/stats` - Get request statistics
- `GET /api/requests/{id}/audit` - Get request audit logs
- `GET /api/requests/{id}/timeline` - Get request timeline view
- `POST /api/requests/bulk-export` - Export multiple requests (JSON/CSV)
- `POST /api/requests/bulk-delete` - Delete multiple requests

### Audit Logs (NEW)
- `GET /api/audit` - Get global audit logs with filters
- `GET /api/audit/export` - Export audit logs for compliance

### Invoice Management
- `POST /api/upload` - Upload PDF files (optionally to a request)
- `POST /api/process` - Queue invoice for background processing
- `GET /api/invoices` - Retrieve user's invoices
- `GET /api/invoices/status?ids={id1,id2,id3}` - Poll job status for processing invoices
- `GET /api/invoices/download?id={id}` - Generate presigned download URL
- `DELETE /api/invoices?id={id}` - Delete single invoice
- `POST /api/invoices/bulk-delete` - Delete multiple invoices
- `POST /api/invoices/bulk-assign-vendor` - Assign vendor to multiple invoices

### Vendor Management
- `GET /api/vendors` - List user's vendors
- `POST /api/vendors` - Create new vendor
- `PATCH /api/vendors/{id}` - Update vendor
- `DELETE /api/vendors/{id}` - Delete vendor
- `GET /api/vendors/{id}/templates` - List vendor templates
- `POST /api/vendors/{id}/templates` - Create vendor template

### Export
- `GET /api/export?format={excel|csv|json}` - Export all invoices
- `POST /api/export/bulk` - Export selected invoices

### Admin
- `POST /api/admin/cleanup-orphaned-files` - Detect orphaned S3 files
- `POST /api/admin/cleanup-orphaned-files?delete=true` - Delete orphaned files

## Cost Considerations

### OpenAI API Costs

This application uses OpenAI's **GPT-4o-mini** API which is highly cost-effective:
- Each PDF processing makes an API call to GPT-4o-mini
- Costs depend on the length of the PDF text
- **Typical invoice: ~$0.001-0.005 per document** (60-80% cheaper than GPT-4 Turbo)
- Pricing: $0.150 per 1M input tokens, $0.600 per 1M output tokens

**Tips to reduce costs**:
- Results are cached in the database - don't reprocess the same file
- GPT-4o-mini is already configured for optimal cost/performance balance
- Monitor your OpenAI usage at [platform.openai.com](https://platform.openai.com)

### AWS S3 Storage Costs (Optional)

If using AWS S3 cloud storage:
- **Standard Storage**: $0.023 per GB/month
- **Glacier Instant Retrieval** (after 90 days): $0.004 per GB/month
- **API Requests**: $0.0004 per 1,000 GET requests, $0.005 per 1,000 PUT requests

**Cost Estimate**:
- **100 invoices/month** @ 500 KB each: ~**$0.02/month** (2 cents)
- **10,000 invoices/month**: ~$20/month
- With Glacier archival after 90 days: 75% cheaper for older files

**Local Storage Alternative**:
- Set `STORAGE_PROVIDER=local` to use free local filesystem storage
- Suitable for development and small-scale deployments

## Troubleshooting

### OpenAI API Errors

- **Error: OPENAI_API_KEY is not configured**
  - Make sure you've added your API key to `.env.local`
  - Restart the development server after updating `.env.local`

- **Error: Rate limit exceeded**
  - Your OpenAI account has hit the rate limit
  - Wait a few minutes or upgrade your OpenAI plan

### PDF Processing Issues

- **Poor extraction quality**
  - Scanned/image-based PDFs may have lower accuracy
  - Try using higher quality PDFs with selectable text
  - Future: Implement GPT-4 Vision for scanned documents

### Database Issues

- **PostgreSQL Connection Errors**
  - Ensure PostgreSQL is running: `pg_isready`
  - Verify DATABASE_URL format: `postgresql://user:password@localhost:5432/database?schema=public`
  - Check PostgreSQL service status

- **Prisma errors**
  - Run `npx prisma generate` to regenerate the client
  - Run `npx prisma db push` to sync schema (or `npx prisma migrate dev` with CREATEDB permission)
  - For shadow database errors, use `npx prisma db push` instead of migrations

### AWS S3 Storage Issues

- **Upload fails with S3 errors**
  - Verify AWS credentials in `.env.local` are correct
  - Check IAM user has required permissions (see setup instructions)
  - Verify S3 bucket name and region match `.env.local`
  - Ensure bucket exists and is accessible
  - **Fallback**: Set `STORAGE_PROVIDER=local` to use local filesystem

- **Cannot download PDFs**
  - Check browser console for presigned URL errors
  - Presigned URLs expire after 1 hour - regenerate if expired
  - Verify file exists in S3 bucket or local storage

- **Orphaned files in S3**
  - Run cleanup API: `POST /api/admin/cleanup-orphaned-files`
  - Review orphaned files before deleting: omit `?delete=true` parameter
  - Delete confirmed orphans: `POST /api/admin/cleanup-orphaned-files?delete=true`

### Redis and Background Job Issues

- **Redis connection errors**
  - Verify Redis is running: `docker ps` or `redis-cli ping`
  - Start Redis: `docker run -d -p 6379:6379 redis:7-alpine`
  - Check `REDIS_URL` in `.env.local` is correct
  - **Development**: Use `redis://localhost:6379`
  - **Production**: Use Upstash or Redis Cloud connection string

- **Worker not processing jobs**
  - Ensure worker is running: `npm run worker:dev` or `npm run dev:all`
  - Check worker logs for errors
  - Verify `WORKER_MODE=separate` in `.env.local`
  - Restart both Next.js and worker after environment changes

- **Jobs stuck in "queued" status**
  - Worker process may not be running - start it with `npm run worker:dev`
  - Check worker logs for processing errors
  - Verify Redis connection is working
  - Check OpenAI API key is configured correctly

- **Environment variable errors in worker**
  - Worker loads `.env.local` automatically via dotenv
  - Ensure `.env.local` exists and contains all required variables
  - Restart worker process after updating `.env.local`

- **Graceful fallback to synchronous mode**
  - Set `WORKER_MODE=disabled` to use synchronous processing
  - Useful for debugging or when Redis is unavailable
  - Processing will be slower but doesn't require worker process

## Future Enhancements

Planned features for future releases:

- **GPT-4 Vision support** for scanned/image-based documents
- **Advanced analytics dashboard** with spending trends and charts
- **User profile page** with account management
- **Settings page** with customization options
- **Custom AI model selection** (GPT-4o, Claude, Gemini, etc.)
- **Webhook notifications** for integrations
- **Mobile app support** (PWA first, then React Native)
- **API documentation** (Swagger/OpenAPI)

See [BACKLOG.md](BACKLOG.md) for detailed roadmap and priorities.

## Recent Updates

### Latest Features (January 2026)

**✅ Batch Upload Request Management System** (NEW - January 2, 2026)
- Organize invoices into named batch requests for better tracking
- Create requests with integrated file upload (drag & drop)
- Request lifecycle management (draft → processing → completed/partial/failed)
- Real-time statistics dashboard (total, processed, failed, pending counts)
- Submit entire batches for processing with one click
- Add files to existing requests or upload independently
- Request detail page with three tabs:
  - **Invoices**: View all invoices in the request
  - **Timeline**: Chronological event history
  - **Audit Trail**: Detailed compliance logs
- Bulk operations (export multiple requests, delete batches)
- Backward compatible (orphaned invoices without requests still supported)

**✅ Comprehensive Audit Trail System** (NEW - January 2, 2026)
- Event logging for compliance and debugging
- Captures all operations: uploads, processing, deletions, bulk actions
- Event categories: request lifecycle, invoice operations, vendor operations, user actions
- Forensic tracking with IP address and user agent
- Before/after value snapshots for change history
- Timeline view with chronological events
- Audit log export for compliance reporting
- Non-blocking logging (failures don't affect primary operations)
- Request statistics automatically update during invoice processing

**✅ Background Job Processing System**
- Asynchronous invoice processing with BullMQ and Redis
- Dedicated worker process for scalability (5 concurrent jobs)
- Real-time status updates via frontend polling
- Enhanced status badges (queued, processing, validation_failed)
- Automatic retry with exponential backoff (3 attempts)
- Job tracking fields (jobId, processingStartedAt, retryCount, lastError)
- Three operational modes: separate worker, embedded, or synchronous fallback
- Support for both serverless (Vercel + Upstash) and self-hosted deployments
- Graceful degradation when Redis is unavailable
- Request statistics update automatically during processing

**✅ AWS S3 Cloud Storage Integration**
- Hybrid local/S3 storage support with automatic fallback
- Presigned URLs for secure PDF downloads
- User-isolated S3 structure (`users/{userId}/invoices/`)
- Server-side AES256 encryption
- Orphaned file cleanup automation
- Zero-downtime migration strategy

**✅ Vendor Management System**
- Automatic vendor detection from invoice text
- Custom extraction templates per vendor
- Field mappings and validation rules
- Three-strategy detection (identifier, AI, fuzzy matching)

**✅ PostgreSQL Database Migration**
- Production-ready scalability
- Optimized text field storage
- Comprehensive migration guide

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the OpenAI API documentation
3. Check Prisma documentation for database issues
