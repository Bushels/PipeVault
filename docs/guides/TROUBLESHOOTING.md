# PipeVault Troubleshooting Guide

This guide covers common issues and their solutions for the PipeVault application.

## Table of Contents
- [Admin Console Errors](#admin-console-errors)
- [Weather Service CORS Error](#weather-service-cors-error)
- [Edge Function Issues](#edge-function-issues)

---

## Admin Console Errors

### Error: "useState is not defined" in AdminDashboard

**Symptoms:**
```
AdminDashboard.tsx:103 Uncaught ReferenceError: useState is not defined
```

**Cause:**
Missing React hook imports in `components/admin/AdminDashboard.tsx`.

**Solution:**
Ensure the following imports are at the top of the file:

```typescript
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import type {
  // ... other types
  AdminSession,
  StorageRequest,
  Company,
  Yard,
} from '../../types';
```

**Fixed in:** November 2025

---

## Weather Service CORS Error

### Error: "Access to fetch blocked by CORS policy"

**Symptoms:**
```
Access to fetch at 'https://[project-id].supabase.co/functions/v1/fetch-realtime-weather'
from origin 'http://localhost:3000' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check: It does not have HTTP ok status.
```

**Cause:**
The `fetch-realtime-weather` Edge Function is either:
1. Not deployed to your Supabase project
2. Missing the `TOMORROW_API_KEY` secret

**Impact:**
- The weather widget will not display real-time data
- The app will use fallback weather data
- This is a non-blocking error - the admin console will still function

**Solution:**

#### Step 1: Deploy the Edge Function

Using Supabase CLI:
```bash
cd supabase
supabase functions deploy fetch-realtime-weather --project-ref [your-project-ref]
```

#### Step 2: Set the Tomorrow.io API Key

1. Get an API key from [Tomorrow.io](https://www.tomorrow.io/weather-api/)
2. Set it as a secret in Supabase:

```bash
supabase secrets set TOMORROW_API_KEY=your_api_key_here --project-ref [your-project-ref]
```

Or via Supabase Dashboard:
1. Go to Project Settings > Edge Functions
2. Add a new secret: `TOMORROW_API_KEY`
3. Set the value to your Tomorrow.io API key

#### Alternative: Disable Weather Feature

If you don't need weather functionality, the error can be safely ignored. The application falls back to static weather data automatically.

---

## Edge Function Issues

### General Edge Function Debugging

**Check if functions are deployed:**
```bash
supabase functions list --project-ref [your-project-ref]
```

**View function logs:**
```bash
supabase functions logs fetch-realtime-weather --project-ref [your-project-ref]
```

**Test locally:**
```bash
supabase functions serve fetch-realtime-weather --env-file .env.local
```

### Common Edge Function Secrets

| Secret Name | Required For | How to Obtain |
|-------------|--------------|---------------|
| `TOMORROW_API_KEY` | Weather widget | [Tomorrow.io](https://www.tomorrow.io/weather-api/) |
| `RESEND_API_KEY` | Email notifications | [Resend.com](https://resend.com/) |
| `SLACK_WEBHOOK_URL` | Slack notifications | Slack App settings |

---

## Need More Help?

1. Check the browser console for detailed error messages
2. Check Supabase logs in the dashboard
3. Review the [deployment guide](./DEPLOYMENT.md)
4. Check [testing guide](./TESTING_GUIDE.md) for verification steps
