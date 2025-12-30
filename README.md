# Invoice Scanner - AI-Powered PDF Processing

A Next.js web application that uses OpenAI GPT-4 to extract structured data from invoice and receipt PDFs, with export functionality to Excel, CSV, and JSON formats.

## Features

- **Multi-User Authentication**: Secure user authentication system with:
  - Email/password registration and login
  - Google OAuth sign-in
  - Email verification
  - Password reset flow
- **Batch PDF Upload**: Drag-and-drop interface for uploading multiple PDF files
- **AI-Powered Extraction**: Uses OpenAI GPT-4 to extract:
  - Invoice/Receipt number
  - Date
  - Line item descriptions
  - Total amount
  - Currency
- **Bulk Operations**: Select multiple invoices for:
  - Bulk delete
  - Bulk export
  - Bulk retry (for failed processes)
- **Data Display**: Interactive table with sorting, filtering, and pagination
- **Multiple Export Formats**: Export processed data to Excel (.xlsx), CSV, or JSON
- **Persistent Storage**: SQLite database with user isolation
- **Responsive UI**: Modern, clean interface with dark mode support

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Authentication**: NextAuth.js v5 with Google OAuth
- **Database**: SQLite with Prisma ORM
- **AI**: OpenAI GPT-4 API
- **PDF Processing**: pdf-parse
- **Email**: Nodemailer (SMTP)
- **UI Components**: shadcn/ui, Tailwind CSS, Radix UI
- **Table**: TanStack React Table
- **File Upload**: react-dropzone

## Prerequisites

- Node.js 18+ installed
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- (Optional) Google OAuth credentials for Google sign-in
- (Optional) SMTP server credentials for email features

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Edit the `.env.local` file with your configuration:

```env
# OpenAI Configuration (Required)
OPENAI_API_KEY=your_openai_api_key_here

# Database
DATABASE_URL="file:./dev.db"
NODE_ENV=development

# NextAuth (Required)
AUTH_SECRET=your_generated_secret_here  # Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

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

**Optional: Email Configuration** (for verification emails and password reset):
- For Gmail: Use an [App Password](https://support.google.com/accounts/answer/185833)
- For other providers: Use your SMTP server credentials
- Leave empty for development (emails will be logged to console)

### 3. Setup Database

The database has already been initialized, but if you need to reset it:

```bash
npx prisma migrate reset
npx prisma generate
```

### 4. Run Development Server

```bash
npm run dev
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

### Uploading and Processing Invoices

1. **Upload PDFs**:
   - Drag and drop PDF files into the upload area, or click to select files
   - Supports multiple files at once (max 10MB per file)

2. **Process with AI**:
   - Click "Process with AI" button after uploading
   - The app will extract text from each PDF and send it to OpenAI GPT-4
   - Processing may take a few seconds per document

3. **View Results**:
   - Processed invoices appear in the table below
   - View invoice number, date, descriptions, and total amount
   - Status badge shows processing status

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
│   │   │   ├── process/       # AI processing endpoint
│   │   │   ├── invoices/      # Invoice CRUD
│   │   │   └── export/        # Export endpoint
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main page
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── FileUpload.tsx    # Upload component
│   │   ├── InvoiceTable.tsx  # Table component
│   │   └── ExportButtons.tsx # Export component
│   ├── lib/                  # Utility libraries
│   │   ├── ai/              # AI extraction logic
│   │   ├── pdf/             # PDF parsing
│   │   ├── export/          # Export functionality
│   │   ├── db/              # Prisma client
│   │   └── utils.ts         # Helper functions
│   └── types/               # TypeScript types
├── prisma/
│   └── schema.prisma        # Database schema
└── public/
    └── uploads/             # Uploaded PDF storage
```

## Database Schema

**Invoice Model**:
- `id`: Unique identifier
- `fileName`: Original file name
- `fileUrl`: Storage path
- `invoiceNumber`: Extracted invoice number
- `date`: Extracted date
- `totalAmount`: Total amount
- `currency`: Currency code
- `status`: Processing status (pending/processing/processed/failed)
- `rawText`: Extracted PDF text
- `aiResponse`: Full AI response
- `lineItems`: Related line items

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
- `POST /api/forgot-password` - Request password reset
- `POST /api/reset-password` - Reset password with token
- `GET /api/verify-email` - Verify email with token

### Invoice Management
- `POST /api/upload` - Upload PDF files
- `POST /api/process` - Process invoice with AI
- `GET /api/invoices` - Retrieve user's invoices
- `DELETE /api/invoices?id={id}` - Delete single invoice
- `POST /api/invoices/bulk-delete` - Delete multiple invoices

### Export
- `GET /api/export?format={excel|csv|json}` - Export all invoices
- `POST /api/export/bulk` - Export selected invoices

## Cost Considerations

This application uses OpenAI's **GPT-4o-mini** API which is highly cost-effective:
- Each PDF processing makes an API call to GPT-4o-mini
- Costs depend on the length of the PDF text
- **Typical invoice: ~$0.001-0.005 per document** (60-80% cheaper than GPT-4 Turbo)
- Pricing: $0.150 per 1M input tokens, $0.600 per 1M output tokens

**Tips to reduce costs**:
- Results are cached in the database - don't reprocess the same file
- GPT-4o-mini is already configured for optimal cost/performance balance
- Monitor your OpenAI usage at [platform.openai.com](https://platform.openai.com)

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

- **Prisma errors**
  - Run `npx prisma generate` to regenerate the client
  - Run `npx prisma migrate dev` if schema changed

## Future Enhancements

- GPT-4 Vision support for scanned documents
- Cloud storage integration (S3, Azure Blob)
- Invoice templates and vendor management
- Advanced analytics dashboard
- Additional OAuth providers (Microsoft, Apple)
- Webhook notifications
- Mobile app support
- API documentation (Swagger/OpenAPI)

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the OpenAI API documentation
3. Check Prisma documentation for database issues
