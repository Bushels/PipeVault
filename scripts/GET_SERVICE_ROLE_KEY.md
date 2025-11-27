# How to Get Your Supabase Service Role Key

## Why You Need It

The Service Role Key is required to run the test user cleanup script because:
1. It bypasses Row Level Security (RLS) policies
2. It allows full database access to query and delete ALL user data
3. The regular `anon` key would only show data visible to the current user

## How to Get It

### Method 1: Supabase Dashboard (Recommended)

1. Open your browser and go to: https://app.supabase.com/project/cvevhvjxnklbbhtqzyvw/settings/api

2. Scroll down to the **"Project API keys"** section

3. Look for the key labeled **`service_role`** (NOT `anon`)

4. Click the **"Copy"** button or **"Reveal"** button to see the full key

5. It should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Method 2: Supabase CLI (If Running Locally)

```bash
npx supabase status
```

Look for the line:
```
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Add It to Your .env File

Once you have the service role key, add it to your `.env` file:

```bash
# Add this line to .env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_actual_key_here
```

**IMPORTANT**: This key has FULL database access.
- ⚠️ NEVER commit it to git
- ⚠️ NEVER share it publicly
- ⚠️ Keep it secret like a password

## Verify It's Set Correctly

Run this command to verify:

```bash
cat .env | grep SERVICE_ROLE
```

You should see:
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Ready to Run the Cleanup Script

Once the service role key is in your `.env` file, you can run:

```bash
npx tsx scripts/cleanup-test-users.ts discover
```

This will show you all the test data that exists in the database.
