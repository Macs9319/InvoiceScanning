# Invoice Scanner - AI Provider Management Scripts

Easy-to-use scripts for managing your AI provider configuration.

## Quick Reference

```bash
# Check current provider
node scripts/check-ai-provider.mjs

# Switch to Gemini (best for scanned PDFs, 80-95% cost savings)
node scripts/switch-to-gemini.mjs

# Switch to OpenAI (fallback when Gemini quota exceeded)
node scripts/switch-to-openai.mjs

# Test Gemini API key and quota
node scripts/test-gemini-quota.mjs
```

## Provider Comparison

### Gemini 2.5 Flash (Recommended)
- ✅ **Native PDF processing** - handles scanned documents automatically
- ✅ **Lowest cost** - ~$0.0002 per page (80-95% cheaper than GPT-4o-mini)
- ✅ **Best for** - All PDF types, especially scanned documents
- ⚠️ **Free tier limits** - 1,500 requests/day, 1M tokens/day
- 📖 **Get API key** - https://aistudio.google.com/app/apikey

### OpenAI GPT-4o-mini
- ✅ **Reliable** - consistent text extraction
- ✅ **No quota limits** - pay-as-you-go only
- ✅ **Best for** - Text-based PDFs
- ❌ **No native PDF** - scanned documents will fail
- ❌ **Higher cost** - ~$0.001-0.005 per page
- 📖 **Get API key** - https://platform.openai.com/api-keys

## Usage Examples

### Switch to Gemini for Cost Savings

```bash
# Test if your Gemini API key works
node scripts/test-gemini-quota.mjs

# If test passes, switch to Gemini
node scripts/switch-to-gemini.mjs

# Restart worker to apply changes
pkill -f "tsx watch src/workers/invoice-processor.ts"
npm run worker:dev
```

### Handle Gemini Quota Exceeded

```bash
# When you see "quota exceeded" errors:
node scripts/switch-to-openai.mjs

# Restart worker
pkill -f "tsx watch src/workers/invoice-processor.ts"
npm run worker:dev

# Switch back to Gemini tomorrow when quota resets
node scripts/test-gemini-quota.mjs
node scripts/switch-to-gemini.mjs
```

## Troubleshooting

### "Quota exceeded"
```bash
# Switch to OpenAI temporarily
node scripts/switch-to-openai.mjs

# Or wait for quota reset (check when)
node scripts/test-gemini-quota.mjs
```

### Worker not picking up changes
```bash
# Always restart worker after switching providers
pkill -f "tsx watch src/workers/invoice-processor.ts"
npm run worker:dev
```
