# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Invoice Scanner is a Next.js 15 application that uses OpenAI GPT-4o-mini to extract structured data from invoice and receipt PDFs. The app features user authentication with NextAuth.js, multi-user support with data isolation, batch processing, persistent storage with SQLite/Prisma, multi-format exports (Excel, CSV, JSON), advanced filtering and search, dark mode theming, error handling with retry functionality, and detailed invoice viewing with loading states.

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

# Database operations
npx prisma generate          # Regenerate Prisma client after schema changes
npx prisma migrate dev       # Create and apply migrations
npx prisma migrate reset     # Reset database (WARNING: deletes all data)
npx prisma studio            # Open Prisma Studio GUI for database inspection
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

1. **Upload Stage** (`/api/upload`): Validates auth → saves PDF files to `public/uploads/` → creates database record with `status: "pending"` and `userId`
2. **AI Processing Stage** (`/api/process`): Validates auth + ownership → extracts text from PDF → sends to OpenAI GPT-4o-mini → parses structured response → saves to database with line items
3. **Export Stage** (`/api/export`): Validates auth → queries user's invoices with line items → generates Excel/CSV/JSON files

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
- **Prisma**: ORM with SQLite database (dev.db)
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
│   │   │   └── bulk-delete/route.ts     # Bulk delete endpoint (auth required)
│   │   └── export/
│   │       ├── route.ts                 # Generate Excel/CSV/JSON exports (auth required)
│   │       └── bulk/route.ts            # Bulk export for selected invoices (auth required)
│   ├── login/page.tsx           # Login/signup page with Google OAuth (client component)
│   ├── verify-email/page.tsx    # Email verification page
│   ├── forgot-password/page.tsx # Password reset request page
│   ├── reset-password/page.tsx  # Password reset confirmation page
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
│   ├── ExportButtons.tsx        # Export action buttons
│   ├── header.tsx               # User info and sign out button
│   ├── session-provider.tsx     # NextAuth SessionProvider wrapper
│   ├── theme-provider.tsx       # next-themes provider wrapper
│   ├── theme-toggle.tsx         # Dark/light mode toggle button
│   └── ui/                      # shadcn/ui components (button, dialog, skeleton, select, checkbox, etc.)
├── lib/
│   ├── auth.ts                  # NextAuth configuration (Credentials + Google OAuth, JWT)
│   ├── ai/extractor.ts          # OpenAI GPT-4o-mini extraction logic
│   ├── pdf/parser.ts            # PDF text extraction (pdfreader)
│   ├── export/                  # Excel, CSV, JSON generators
│   ├── email/                   # Email sending (nodemailer) and templates
│   └── db/prisma.ts             # Prisma client singleton
└── types/invoice.ts             # Zod schemas + TypeScript types
```

## Database Schema

### User Model (Authentication)
- Primary entity for user accounts
- `email`: Unique identifier for login
- `password`: Hashed with bcryptjs (10 rounds), nullable for OAuth-only accounts
- `emailVerified`: Timestamp of email verification (null until verified)
- One-to-many relationships: invoices, accounts (OAuth), sessions
- All user data cascades on delete

### Invoice Model
- Primary entity with one-to-many relationship to LineItem
- **User Isolation**: `userId` foreign key ensures each invoice belongs to one user
- `status` field: "pending" → "processing" → "processed" or "failed"
- `rawText`: Full PDF text extracted by pdfreader
- `aiResponse`: Raw JSON response from OpenAI OR error details (stored as string)
- `fileUrl`: Relative path from `public/` (e.g., `/uploads/filename.pdf`)
- Indexes on `userId`, `status`, and `date` for query performance

### LineItem Model
- Child entity linked via `invoiceId` (cascade delete enabled)
- `order`: Display sequence for line items
- All fields except `description` are nullable (some invoices lack detailed breakdowns)

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
DATABASE_URL="file:./dev.db"                             # SQLite database path
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

## AI Extraction Logic

### OpenAI Configuration
- Model: `gpt-4o-mini` (src/lib/ai/extractor.ts:49) - Cost-effective choice, ~60-80% cheaper than GPT-4 Turbo
- Uses `response_format: { type: "json_object" }` to enforce JSON responses
- Temperature: 0.1 for consistent, deterministic extraction
- Zod validation ensures type safety before database insertion

### Extraction Prompt Structure
The prompt (src/lib/ai/extractor.ts:8-38) instructs GPT-4 to:
- Return JSON with fields: invoiceNumber, date (ISO 8601), totalAmount, currency, lineItems
- Use `null` for missing fields (not empty strings)
- Parse amounts as numbers without currency symbols
- Extract all line items with description/quantity/unitPrice/amount

### Fallback Strategy
`extractInvoiceDataWithFallback()` is a stub for future GPT-4 Vision integration to handle scanned/image-based PDFs. Currently, it just calls text extraction.

## Path Aliases

The project uses TypeScript path aliases:
- `@/*` → `./src/*`

Example: `import { prisma } from "@/lib/db/prisma"`

## Common Development Patterns

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

After schema changes in `prisma/schema.prisma`:
```bash
npx prisma migrate dev --name descriptive_name  # Creates migration + applies it
npx prisma generate                              # Regenerates TypeScript types
```

Include related data in queries:
```typescript
await prisma.invoice.findMany({
  include: { lineItems: true }  // Joins LineItem records
})
```

## File Upload Handling

- Files are saved to `public/uploads/` directory
- `fileUrl` in database stores relative path: `/uploads/filename.pdf`
- Max file size: 10MB (validated in client and can be enforced server-side)
- File validation: Must be `application/pdf` MIME type

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
2. **Local File Storage**: Files stored in `public/uploads/`. Not suitable for production (use S3/Azure Blob).
3. **No Background Jobs**: Processing is synchronous. Large PDFs may timeout.
4. **SQLite**: Not suitable for concurrent writes in high-traffic scenarios. Use PostgreSQL/MySQL for production deployments.

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
- Selection persists across filter changes but resets on page change

### Error Handling & Retry
- Failed invoices show alert icon with error details
- Error messages stored in `aiResponse` field with timestamp
- Click eye icon to view full error details in modal
- Retry button (↻ icon) re-processes failed invoices
- Retry clears previous line items and resets status to "processing"
- Loading spinner shows during retry operation

## Recent Improvements

1. **Multi-Provider Authentication**:
   - Email/password authentication with bcrypt
   - Google OAuth sign-in with account linking
   - Email verification flow with token-based validation
   - Password reset functionality via email
2. **Bulk Operations**:
   - Row selection with checkboxes
   - Bulk export (Excel/CSV/JSON) for selected invoices
   - Bulk delete with confirmation
   - Bulk retry for failed processing
3. **Advanced Filtering**: Search, status/currency/date/amount filters, pagination
4. **Error Handling**: Detailed error messages, retry functionality for failed invoices
5. **Model Change** (Cost Optimization): Switched from `gpt-4-turbo-preview` to `gpt-4o-mini` for 60-80% cost reduction
6. **Dark Mode**: Full theme support with toggle and persistence
7. **Loading States**: Skeleton loaders and progress indicators improve UX
8. **Invoice Details**: Comprehensive view modal with all invoice data and error details
