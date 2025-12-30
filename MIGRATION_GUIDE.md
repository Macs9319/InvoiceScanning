# Database Migration Guide: SQLite to PostgreSQL

This guide will help you migrate your existing Invoice Scanner application from SQLite to PostgreSQL.

## Prerequisites

- PostgreSQL 12 or later installed and running
- Access to your existing SQLite database (`prisma/dev.db`)
- Database backup (recommended)

## Migration Steps

### Step 1: Backup Your Existing Data

Before starting the migration, create a backup of your SQLite database:

```bash
# Copy the SQLite database file
cp prisma/dev.db prisma/dev.db.backup

# Export data using Prisma (optional, for extra safety)
npx prisma db pull
```

### Step 2: Set Up PostgreSQL Database

Create a new PostgreSQL database for the application:

```bash
# Using psql (PostgreSQL command-line tool)
psql -U postgres

# In the psql shell:
CREATE DATABASE invoice_scanner;
CREATE USER invoice_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE invoice_scanner TO invoice_user;
\q
```

Alternatively, use a hosted PostgreSQL service:
- **Railway**: https://railway.app
- **Supabase**: https://supabase.com
- **Neon**: https://neon.tech
- **AWS RDS**: https://aws.amazon.com/rds/postgresql/
- **Google Cloud SQL**: https://cloud.google.com/sql/postgresql

### Step 3: Update Environment Variables

Update your `.env.local` file with the PostgreSQL connection string:

```env
# Old SQLite configuration (comment out or remove)
# DATABASE_URL="file:./dev.db"

# New PostgreSQL configuration
DATABASE_URL="postgresql://invoice_user:your_secure_password@localhost:5432/invoice_scanner?schema=public"
```

**Connection String Format**:
```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA
```

**Examples**:
- Local: `postgresql://postgres:password@localhost:5432/invoice_scanner?schema=public`
- Railway: `postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway?schema=public`
- Supabase: `postgresql://postgres:password@db.project.supabase.co:5432/postgres?schema=public`

### Step 4: Update Prisma Schema

The Prisma schema has already been updated to use PostgreSQL. Verify the datasource configuration in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 5: Create PostgreSQL Schema

Generate the initial migration and apply it to your PostgreSQL database:

```bash
# Generate Prisma client for PostgreSQL
npx prisma generate

# Create and apply the initial migration
npx prisma migrate dev --name init

# Alternatively, push schema without migrations (development only)
npx prisma db push
```

### Step 6: Migrate Data from SQLite to PostgreSQL

There are several approaches to migrate your existing data:

#### Option A: Manual Export/Import (Recommended for Small Datasets)

1. Export data from SQLite using Prisma Studio:
```bash
# Open Prisma Studio with SQLite (temporarily switch back)
# Edit prisma/schema.prisma to use SQLite temporarily
npx prisma studio
```

2. Export data as JSON from each table

3. Switch back to PostgreSQL in `prisma/schema.prisma`

4. Import data using a migration script (see Option C)

#### Option B: Using pg_dump and SQLite Export

```bash
# Export SQLite to SQL dump
sqlite3 prisma/dev.db .dump > sqlite_dump.sql

# Manual conversion required - SQLite and PostgreSQL SQL syntax differs
# This option requires manual SQL editing and is not recommended
```

#### Option C: Using a Prisma Migration Script (Recommended)

Create a migration script `scripts/migrate-data.ts`:

```typescript
import { PrismaClient as SQLiteClient } from '@prisma/client';
import { PrismaClient as PostgresClient } from '@prisma/client';

// This is a template - you'll need to adjust based on your data volume
async function migrate() {
  // 1. Configure SQLite connection (temporarily)
  const sqlite = new SQLiteClient({
    datasources: {
      db: {
        url: 'file:./prisma/dev.db'
      }
    }
  });

  // 2. Configure PostgreSQL connection
  const postgres = new PostgresClient();

  try {
    console.log('Starting migration...');

    // Migrate users first (due to foreign keys)
    const users = await sqlite.user.findMany();
    for (const user of users) {
      await postgres.user.create({ data: user });
    }
    console.log(`Migrated ${users.length} users`);

    // Migrate accounts
    const accounts = await sqlite.account.findMany();
    for (const account of accounts) {
      await postgres.account.create({ data: account });
    }
    console.log(`Migrated ${accounts.length} accounts`);

    // Migrate vendors
    const vendors = await sqlite.vendor.findMany();
    for (const vendor of vendors) {
      await postgres.vendor.create({ data: vendor });
    }
    console.log(`Migrated ${vendors.length} vendors`);

    // Migrate vendor templates
    const templates = await sqlite.vendorTemplate.findMany();
    for (const template of templates) {
      await postgres.vendorTemplate.create({ data: template });
    }
    console.log(`Migrated ${templates.length} templates`);

    // Migrate invoices (with line items)
    const invoices = await sqlite.invoice.findMany({
      include: { lineItems: true }
    });
    for (const invoice of invoices) {
      const { lineItems, ...invoiceData } = invoice;
      await postgres.invoice.create({
        data: {
          ...invoiceData,
          lineItems: {
            create: lineItems
          }
        }
      });
    }
    console.log(`Migrated ${invoices.length} invoices`);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sqlite.$disconnect();
    await postgres.$disconnect();
  }
}

migrate();
```

Run the migration script:
```bash
npx ts-node scripts/migrate-data.ts
```

#### Option D: Using pgloader (For Large Datasets)

If you have a large dataset, consider using `pgloader`:

```bash
# Install pgloader
# macOS: brew install pgloader
# Ubuntu: apt-get install pgloader

# Create pgloader config file (sqlite-to-postgres.load)
# Then run:
pgloader sqlite-to-postgres.load
```

### Step 7: Verify Migration

After migrating data, verify the migration was successful:

```bash
# Open Prisma Studio to inspect data
npx prisma studio

# Check record counts
psql -U invoice_user -d invoice_scanner -c "SELECT
  (SELECT COUNT(*) FROM \"User\") as users,
  (SELECT COUNT(*) FROM \"Invoice\") as invoices,
  (SELECT COUNT(*) FROM \"LineItem\") as line_items,
  (SELECT COUNT(*) FROM \"Vendor\") as vendors;"
```

### Step 8: Test the Application

1. Start the development server:
```bash
npm run dev
```

2. Test key functionality:
   - Login/authentication
   - Upload and process invoices
   - View existing invoices
   - Export data
   - Vendor management

3. Check for any errors in the console

### Step 9: Update Deployment Configuration

If deploying to production, update your deployment platform's environment variables:

**Vercel**:
```bash
vercel env add DATABASE_URL
# Enter your PostgreSQL connection string
```

**Railway**:
- Add PostgreSQL plugin
- Copy connection string to DATABASE_URL environment variable

**Heroku**:
```bash
heroku config:set DATABASE_URL="postgresql://..."
```

## Troubleshooting

### Connection Errors

**Error**: `Can't reach database server`
- Check if PostgreSQL is running: `pg_isready`
- Verify connection string format
- Check firewall settings

**Error**: `SSL connection required`
- Add `?sslmode=require` to connection string
- For local development: `?sslmode=disable`

### Migration Errors

**Error**: `Foreign key constraint failed`
- Ensure you migrate parent tables before child tables
- Order: Users → Accounts/Vendors → Vendor Templates → Invoices → Line Items

**Error**: `Unique constraint violation`
- Check for duplicate data in source database
- Ensure migrations are not run multiple times

### Performance Issues

If queries are slow after migration:
```bash
# Analyze tables and create statistics
psql -U invoice_user -d invoice_scanner -c "ANALYZE;"

# Check if indexes were created
psql -U invoice_user -d invoice_scanner -c "\di"
```

## Rollback Plan

If you need to rollback to SQLite:

1. Stop the application
2. Edit `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. Update `.env.local`:
   ```env
   DATABASE_URL="file:./dev.db"
   ```
4. Restore backup if needed:
   ```bash
   cp prisma/dev.db.backup prisma/dev.db
   ```
5. Regenerate Prisma client:
   ```bash
   npx prisma generate
   ```

## Production Deployment Checklist

- [ ] PostgreSQL database created and configured
- [ ] Connection string uses SSL (`sslmode=require`)
- [ ] Database user has appropriate permissions (not superuser)
- [ ] Connection pooling configured (recommended: PgBouncer or Prisma Accelerate)
- [ ] Database backups scheduled
- [ ] Environment variables set in production
- [ ] All data migrated and verified
- [ ] Application tested in staging environment
- [ ] Monitoring and alerts configured

## Additional Resources

- [Prisma PostgreSQL Guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Database Connection Pooling](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)

## Support

If you encounter issues during migration:
1. Check the error logs in the console
2. Review the Prisma documentation
3. Search for similar issues in the Prisma GitHub repository
4. Create an issue in the project repository with detailed error information
