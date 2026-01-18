# Google Gemini API Setup Guide

## 🎯 Why Gemini is the Default Provider

**Default AI Provider**: As of January 2026, Invoice Scanner uses **Gemini 2.5 Flash** as the default AI provider for optimal cost-effectiveness and performance.

**Cost Savings**: Gemini 2.5 Flash offers **80-95% cost reduction** compared to GPT-4o-mini Vision for scanned PDFs.

**Performance Comparison** (3-page scanned invoice):
- GPT-4o-mini Vision: $0.009-0.030
- **Gemini 2.5 Flash**: $0.0006 (95% cheaper!)
- **Claude 3.5 Haiku**: $0.003 (90% cheaper)

**Key Benefits**:
- ✅ **Default provider** - Required for invoice processing
- ✅ Native PDF support (no image conversion needed)
- ✅ **Automatic scanned document detection** and routing
- ✅ Ultra-low cost for both text and scanned documents
- ✅ Fast processing (2-4 seconds per invoice)
- ✅ Excellent accuracy on invoices and receipts
- ✅ Free tier available (60 requests per minute)

---

## 📋 Step-by-Step: Get Your Gemini API Key

### Step 1: Visit Google AI Studio

Go to: **https://aistudio.google.com/app/apikey**

### Step 2: Sign In with Google Account

- Use any Google account (Gmail, Google Workspace, etc.)
- No credit card required for free tier
- Free tier: 60 requests/minute, 1500 requests/day

### Step 3: Create API Key

1. Click **"Get API key"** or **"Create API key"**
2. Select your Google Cloud project (or create new one)
3. Click **"Create API key in new project"** if you don't have one
4. **Copy the API key** - it looks like: `AIzaSyA...`

**⚠️ Important**: Save your API key securely. Don't commit it to version control!

### Step 4: Add to Your Environment

Open `.env.local` and add:

```env
GOOGLE_AI_API_KEY=AIzaSyA_your_actual_api_key_here
```

### Step 5: Restart Your Development Server

```bash
# Stop current server (Ctrl+C)
npm run dev:all
```

### Step 6: Verify It Works

Upload a scanned invoice and check console logs for:
```
Scanned document detected - using native PDF processing
Native PDF extraction completed in XXXms
Estimated cost: $0.000XXX
```

---

## 🆓 Free Tier Limits

**Gemini 2.5 Flash Free Tier**:
- **Requests per minute (RPM)**: 15
- **Requests per day (RPD)**: 1,500
- **Tokens per minute (TPM)**: 1,000,000
- **Cost**: $0 (completely free)

**Typical Invoice Processing**:
- 3-page scanned invoice: ~2,000 tokens
- Can process ~500 invoices per minute (well within limits)
- Daily capacity: 1,500 invoices/day (45,000/month)

**When You Need More**:
- Enable billing in Google Cloud Console
- Pay-as-you-go pricing kicks in
- Still ultra-cheap: $0.15 per 1M input tokens, $0.60 per 1M output

---

## 💰 Pricing Comparison

### Monthly Cost Projection (Scanned PDFs)

| Invoices/Month | GPT-4o-mini Vision | Gemini 2.5 Flash | **Savings** |
|----------------|-------------------|------------------|-------------|
| 1,000          | $9-30             | **$0.60**        | **93-98%**  |
| 10,000         | $90-300           | **$6**           | **93-98%**  |
| 100,000        | $900-3,000        | **$60**          | **93-98%**  |

### Per-Invoice Cost (3-page document)

| Provider | Method | Cost | Use Case |
|----------|--------|------|----------|
| **Gemini 2.5 Flash** | Native PDF | **$0.0006** | ✅ Default provider - Best balance |
| **Claude 3.5 Haiku** | Native PDF | $0.003 | Fast, good quality |
| **GPT-4o-mini** | Vision | $0.009-0.030 | Alternative provider |
| **Claude 3.5 Sonnet** | Native PDF | $0.018-0.030 | Best quality |

---

## 🔧 Configuration Options

### Option 1: System Default (Recommended for Testing)

Just add the API key - system will automatically use Gemini for scanned PDFs:

```env
GOOGLE_AI_API_KEY=your_api_key_here
```

The fallback system automatically:
1. Detects if PDF is scanned
2. Uses Gemini native PDF if available
3. Falls back to text extraction if not scanned

### Option 2: Set as Default Provider

To use Gemini for ALL invoices (not just scanned):

1. Go to **Settings** page in the app
2. Under **AI Configuration**, select:
   - Provider: `Gemini`
   - Model: `gemini-1.5-flash`
3. Click **Save**

### Option 3: Per-Vendor Configuration

To use Gemini for specific vendors:

1. Go to **Vendors** page
2. Edit a vendor → **Templates** tab
3. Configure AI settings:
   - Provider: `Gemini`
   - Model: `gemini-1.5-flash`

---

## 🧪 Testing Your Setup

### Quick Test with Sample Invoice

```bash
# Create a test directory
mkdir -p test-invoices

# Download a sample scanned invoice (or use your own)
# Then run the comparison script:
npx tsx scripts/test-pdf-providers.ts ./test-invoices/sample-invoice.pdf
```

Expected output:
```
━━━ Testing Providers ━━━

  → Testing openai with TEXT extraction...
✓ openai (gpt-4o-mini)
   Cost: $0.001234

  → Testing gemini with TEXT extraction...
✓ gemini (gemini-1.5-flash)
   Cost: $0.000089

  → Testing gemini with NATIVE PDF processing...
✓ gemini (gemini-1.5-flash)
   Cost: $0.000003  ← 95% cheaper!

💰 Cost Savings Analysis
Cheapest: gemini (native-pdf) at $0.000003
Savings: 99.8% ($0.001231 per invoice)
```

### Testing Through the Web UI

1. **Upload a scanned invoice**:
   - Visit http://localhost:3002
   - Click "Upload Invoice"
   - Select a scanned PDF

2. **Check the console logs**:
   ```
   Scanned document detected - using native PDF processing
   Native PDF extraction completed in 2341ms
   Estimated cost: $0.000289
   Invoice abc123: Processed with native PDF extraction
   ```

3. **Verify in database**:
   - `processedWithVision: true`
   - `visionApiCost: 0.000289`
   - `isScanned: true`

---

## 🚨 Troubleshooting

### Error: "API key not found for gemini"

**Solution**: Add `GOOGLE_AI_API_KEY` to `.env.local` and restart server

```bash
# In .env.local
GOOGLE_AI_API_KEY=AIzaSyA_your_key_here

# Restart
npm run dev:all
```

### Error: "API key invalid"

**Causes**:
1. API key copied incorrectly (extra spaces, line breaks)
2. API key revoked in Google AI Studio
3. API key not activated yet (wait 1-2 minutes)

**Solution**: Generate a new API key from Google AI Studio

### Error: "Quota exceeded"

**Free Tier Exceeded**:
- You've hit 15 RPM or 1,500 RPD limit
- Wait for quota to reset (resets every minute/day)
- Or enable billing for higher limits

**Solution**: Enable billing in Google Cloud Console or wait for reset

### Scanned PDFs Not Using Gemini

**Check**:
1. Is `GOOGLE_AI_API_KEY` set in `.env.local`?
2. Did you restart the server after adding the key?
3. Is the PDF actually scanned? (Check console logs for "Scanned document detected")

**Force Native PDF Processing**:
Set Gemini as default provider in Settings page

---

## 📊 Monitoring Costs

### Check Actual Costs in Database

```sql
-- Query to see native PDF processing costs
SELECT
  fileName,
  isScanned,
  processedWithVision,
  visionApiCost,
  createdAt
FROM Invoice
WHERE processedWithVision = true
ORDER BY createdAt DESC
LIMIT 100;
```

### Monthly Cost Summary

```sql
-- Monthly cost breakdown
SELECT
  DATE_TRUNC('month', createdAt) as month,
  COUNT(*) as total_invoices,
  SUM(CASE WHEN processedWithVision THEN 1 ELSE 0 END) as native_pdf_count,
  SUM(visionApiCost) as total_cost,
  AVG(visionApiCost) as avg_cost_per_invoice
FROM Invoice
WHERE processedWithVision = true
GROUP BY month
ORDER BY month DESC;
```

---

## 🎓 Best Practices

### 1. Hybrid Approach (Recommended)

Use the automatic fallback system:
- Text-based PDFs → OpenAI (fast, cheap)
- Scanned PDFs → Gemini (ultra-cheap native PDF)
- Complex layouts → Claude (best quality)

**No configuration needed** - system auto-detects!

### 2. Volume Optimization

**Low volume** (<1,000/month):
- Use free tier for everything
- $0 monthly cost

**Medium volume** (1,000-50,000/month):
- Enable Gemini billing
- Still ultra-cheap ($0.30-15/month)

**High volume** (>100,000/month):
- Contact Google for enterprise pricing
- Potential volume discounts

### 3. Quality vs Cost Trade-off

**Recommended (Default)**:
- Use Gemini 2.5 Flash for everything (automatic)
- ~80-95% cost reduction
- Native PDF support for both text and scanned documents

**Alternative**:
- Configure OpenAI or Claude via Settings page
- Vendor-specific provider selection available
- Complex → Claude

**Maximum Quality**:
- All invoices → Claude 3.5 Sonnet
- Use prompt caching for similar invoices
- 50% discount via Batch API

---

## 🔗 Useful Links

- **Get API Key**: https://aistudio.google.com/app/apikey
- **Gemini API Docs**: https://ai.google.dev/gemini-api/docs
- **Pricing**: https://ai.google.dev/pricing
- **Google Cloud Console**: https://console.cloud.google.com
- **Quota Limits**: https://ai.google.dev/gemini-api/docs/quota

---

## ✅ Quick Checklist

Before going live with Gemini:

- [ ] API key obtained from Google AI Studio
- [ ] API key added to `.env.local`
- [ ] Server restarted
- [ ] Tested with sample scanned invoice
- [ ] Verified cost savings in console logs
- [ ] Checked database for `visionApiCost` field
- [ ] Monitored free tier usage (15 RPM, 1,500 RPD)
- [ ] Enabled billing if needed (for >1,500/day)

---

## 💡 Next Steps

1. **Get Your API Key**: https://aistudio.google.com/app/apikey
2. **Add to `.env.local`**: `GOOGLE_AI_API_KEY=your_key_here`
3. **Restart Server**: `npm run dev:all`
4. **Test It**: Upload a scanned invoice
5. **Check Savings**: Run `npx tsx scripts/test-pdf-providers.ts`

**Expected Result**: 95% cost reduction on scanned documents! 🎉
