# AI Services Troubleshooting Guide

This guide documents common issues with AI integrations (Gemini, Claude) and their solutions.

---

## Issue: Gemini Document Upload Fails with 404 Model Not Found

**Date Discovered:** 2025-11-05

### Symptoms
```
Error uploading shipping manifest:
[GoogleGenerativeAI Error]: Error fetching from
https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent:
[404] models/gemini-1.5-flash is not found for API version v1beta,
or is not supported for generateContent.
```

### Root Cause
The `manifestProcessingService.ts` file was using an outdated Gemini model name (`gemini-1.5-flash`) that is no longer available in the Google Generative AI API v1beta version.

### Impact
- Document upload/processing completely broken
- Manifest extraction from PDFs/images fails
- Validation of extracted pipe data fails
- Shipping workflow blocked

### Solution
Update both model references in `services/manifestProcessingService.ts`:

**Lines to Change:**
- Line 190: `extractManifestData()` function
- Line 265: `validateManifestData()` function

**Change from:**
```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0.1,
    topK: 1,
    topP: 0.95,
  }
});
```

**Change to:**
```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    temperature: 0.1,
    topK: 1,
    topP: 0.95,
  }
});
```

### Verification
1. Build the project: `npm run build`
2. Upload a test manifest PDF
3. Verify extraction completes without 404 error
4. Check extracted data appears in admin dashboard

### Prevention
- **Keep model names synchronized** across all service files
- When updating Gemini models, search for all instances:
  ```bash
  grep -r "gemini-" services/
  ```
- Current model standard: `gemini-2.0-flash-exp` for all services
- Check `geminiService.ts` for the canonical model name

### Related Files
- `services/manifestProcessingService.ts` - Manifest extraction/validation
- `services/geminiService.ts` - Chat, summaries, form helper (uses `gemini-2.5-flash`)

---

## Issue: Gemini Model Version Inconsistencies

### Current Model Usage (as of 2025-11-05)

| Service | File | Model | Purpose |
|---------|------|-------|---------|
| Request Summaries | `geminiService.ts:98` | `gemini-2.5-flash` | Generate storage request summaries |
| Customer Chatbot | `geminiService.ts:198` | `gemini-2.5-flash` | Roughneck AI customer assistant |
| Admin Assistant | `geminiService.ts:262` | `gemini-2.5-flash` | Admin operations assistant |
| Form Helper | `geminiService.ts:324` | `gemini-2.5-flash` | Form completion help |
| Manifest Extraction | `manifestProcessingService.ts:190` | `gemini-2.0-flash-exp` | OCR/Vision for pipe data |
| Manifest Validation | `manifestProcessingService.ts:265` | `gemini-2.0-flash-exp` | Data quality checks |

### Notes
- `gemini-2.5-flash` is used for text generation (chat, summaries)
- `gemini-2.0-flash-exp` is used for vision tasks (document OCR)
- These may be consolidated in future Google AI updates

---

## Issue: Rate Limiting or Quota Exceeded

### Symptoms
```
[GoogleGenerativeAI Error]: 429 Resource exhausted
```

### Causes
1. **Free tier limits exceeded** (15 requests/minute, 1500 requests/day)
2. **Rapid-fire testing** without delays
3. **Concurrent requests** from multiple users

### Solutions

**Short-term:**
1. Add request throttling in service files
2. Implement exponential backoff on retry
3. Cache frequently requested AI responses

**Long-term:**
1. Upgrade to paid tier if usage is consistent
2. Implement request queue with rate limiting
3. Add fallback responses for common queries

**Example throttle implementation:**
```typescript
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Before AI call
await delay(100); // 100ms delay between requests
const response = await model.generateContent(prompt);
```

---

## Issue: Claude API 401 Unauthorized

### Symptoms
- Form helper chatbot fails to respond
- Admin AI assistant returns error
- Console shows Anthropic API authentication errors

### Common Causes
1. **Missing API key** - `VITE_ANTHROPIC_API_KEY` not set in `.env`
2. **Invalid API key** - Key expired or revoked
3. **Wrong key format** - Key should start with `sk-ant-`

### Solution
1. Check `.env` file exists in project root
2. Verify key format: `VITE_ANTHROPIC_API_KEY=sk-ant-api03-...`
3. Restart dev server after updating `.env`
4. For production, set environment variables in hosting platform

### Verification
```bash
# Check if key is loaded
npm run dev
# Open browser console, look for: "VITE_ANTHROPIC_API_KEY environment variable not set"
```

---

## Issue: API Response Too Slow

### Symptoms
- User waits 10-30 seconds for AI response
- UI appears frozen during generation
- Timeout errors

### Optimizations

**1. Use Faster Models**
- `gemini-2.5-flash` (current) ✅ Fast
- `gemini-2.0-flash-exp` (current) ✅ Fast
- ❌ Avoid: `gemini-pro` (slower, unnecessary for our use case)

**2. Reduce Token Count**
```typescript
// Bad: Sending entire inventory JSON every time
const inventoryJson = JSON.stringify(inventory, null, 2); // 50KB+

// Good: Send only relevant fields
const relevantData = inventory.map(item => ({
  type: item.type,
  quantity: item.quantity,
  status: item.status
}));
```

**3. Add Loading States**
- Show spinner immediately on request
- Stream responses when API supports it
- Use optimistic UI updates

**4. Cache Common Responses**
```typescript
const responseCache = new Map<string, string>();

// Check cache first
const cacheKey = JSON.stringify({ model, prompt });
if (responseCache.has(cacheKey)) {
  return responseCache.get(cacheKey);
}

// Call API and cache result
const response = await ai.generateContent(prompt);
responseCache.set(cacheKey, response.text);
```

---

## Best Practices

### 1. Error Handling
Always wrap AI calls in try-catch with user-friendly fallbacks:

```typescript
try {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  return response.text;
} catch (error) {
  console.error("AI generation failed:", error);
  // Return helpful fallback instead of crashing
  return "I'm having trouble processing your request right now. Please try again or contact support.";
}
```

### 2. Model Selection
- **Vision tasks** (PDFs, images): Use `gemini-2.0-flash-exp`
- **Text generation**: Use `gemini-2.5-flash`
- **Never use**: Deprecated models like `gemini-1.5-flash`

### 3. Prompt Engineering
- Keep prompts concise and focused
- Include context only when necessary
- Use structured output formats (JSON)
- Test prompts with edge cases

### 4. Cost Optimization
- **Gemini Free Tier**: 15 RPM, 1,500 RPD
- **Strategy**: Cache responses, throttle requests, use appropriate models
- **Monitor**: Check Google AI Studio dashboard for usage

---

## Debugging Checklist

When AI integration fails:

- [ ] Check browser console for API errors
- [ ] Verify API keys are set in `.env`
- [ ] Confirm model names are current (not deprecated)
- [ ] Test with simple prompt first
- [ ] Check network tab for 401/403/429 status codes
- [ ] Review rate limits in Google AI Studio
- [ ] Verify `.env` changes were picked up (restart dev server)
- [ ] Check if using correct API endpoint (v1beta vs v1)

---

## Quick Reference: Current Model Configuration

```typescript
// geminiService.ts - Text generation
model: 'gemini-2.5-flash'

// manifestProcessingService.ts - Vision/OCR
model: 'gemini-2.0-flash-exp'
```

---

## Getting Help

If issues persist:

1. **Check Google AI Status**: https://status.cloud.google.com/
2. **Review API docs**: https://ai.google.dev/docs
3. **Search error code**: Copy full error message to Google
4. **Check this guide**: Most common issues documented above
5. **Update dependencies**: `npm update @google/generative-ai`

---

**Last Updated:** 2025-11-05
**Document Maintained By:** Development Team
