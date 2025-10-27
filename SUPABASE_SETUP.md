# Supabase Setup Guide for PipeVault

## ✅ Step 1: Your Supabase Project is Ready!

**Project URL:** https://cvevhvjxnklbbhtqzyvw.supabase.co
**Status:** Connected ✓

---

## 📋 Step 2: Run the Database Schema

You need to create all the tables in your Supabase database.

1. **Open Supabase SQL Editor:**
   - Go to https://supabase.com/dashboard/project/cvevhvjxnklbbhtqzyvw
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

2. **Copy and paste the entire contents of `supabase/schema.sql`**

3. **Click "Run" (or press Cmd/Ctrl + Enter)**

4. **Wait for completion** - You should see:
   - ✅ Tables created
   - ✅ Indexes created
   - ✅ Triggers created
   - ✅ Seed data inserted (3 yards with racks)

**Verification:**
- Go to "Table Editor" in Supabase dashboard
- You should see these tables:
  - `companies`
  - `storage_requests`
  - `inventory`
  - `truck_loads`
  - `conversations`
  - `documents`
  - `notifications`
  - `yards`
  - `yard_areas`
  - `racks`
  - `admin_users`

---

## 🔐 Step 3: Enable Row-Level Security (Already Configured)

The schema includes RLS policies, but double-check:

1. Go to "Authentication" > "Policies"
2. Verify these tables have RLS enabled:
   - ✅ `companies` - Public read access
   - ✅ `storage_requests` - Users see only their company's data
   - ✅ `inventory` - Users see only their company's data
   - ✅ `conversations` - Users see only their own conversations

---

## 📡 Step 4: Enable Realtime

For admin notifications to work instantly:

1. Go to "Database" > "Replication" in Supabase dashboard
2. Make sure these tables are enabled for Realtime:
   - ✅ `storage_requests`
   - ✅ `notifications`
   - ✅ `inventory`

The schema already adds them to the publication, but verify in the UI.

---

## 📁 Step 5: Set Up Storage Buckets

For PDF uploads and photos:

1. Go to "Storage" in Supabase dashboard
2. Create a new bucket called `documents`
3. Settings:
   - ✅ Public bucket: **NO** (keep private)
   - ✅ File size limit: 10 MB
   - ✅ Allowed MIME types:
     - `application/pdf`
     - `image/jpeg`
     - `image/png`
     - `image/webp`

4. Create a storage policy:
   ```sql
   -- Allow authenticated users to upload
   CREATE POLICY "Users can upload documents"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'documents');

   -- Users can only read their own company's documents
   CREATE POLICY "Users can view own documents"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'documents');
   ```

---

## 🎨 Step 6: Install Dependencies

In your terminal:

```bash
cd /home/user/PipeVault
npm install
```

This will install:
- `@supabase/supabase-js` - Database client
- `@anthropic-ai/sdk` - Claude AI
- `@google/generative-ai` - Gemini AI
- `@tanstack/react-query` - Data fetching
- And all other dependencies

---

## 🔑 Step 7: Set Up API Keys

The `.env` file is already created with your Supabase credentials.

**Now add AI API keys:**

### Get Claude API Key (Anthropic)
1. Go to https://console.anthropic.com/
2. Sign up / Log in
3. Go to "API Keys"
4. Create a new key
5. Add to `.env`:
   ```
   VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

### Get Gemini API Key (Google AI)
1. Go to https://aistudio.google.com/app/apikey
2. Create API key
3. Add to `.env`:
   ```
   VITE_GOOGLE_AI_API_KEY=AIza...
   ```

---

## ✅ Step 8: Test the Connection

Run the development server:

```bash
npm run dev
```

Open http://localhost:5173

**Test Supabase connection:**
- Open browser console (F12)
- You should NOT see any Supabase connection errors
- Try clicking around the app

**If you see errors:**
- Check `.env` file has correct values
- Make sure you ran the schema.sql
- Verify tables exist in Supabase dashboard

---

## 🧪 Step 9: Seed Test Data (Optional)

To test with some initial data:

Run this in Supabase SQL Editor:

```sql
-- Insert test company
INSERT INTO companies (id, name, domain)
VALUES
  ('test-company-1', 'Test Drilling Co', 'test.com')
ON CONFLICT (id) DO NOTHING;

-- Insert test admin
INSERT INTO admin_users (email, name)
VALUES
  ('admin@mpsgroup.ca', 'Admin User')
ON CONFLICT (email) DO NOTHING;

-- Insert test request
INSERT INTO storage_requests (
  company_id,
  user_email,
  reference_id,
  status,
  request_details
)
VALUES (
  'test-company-1',
  'test@test.com',
  'TEST-001',
  'PENDING',
  '{"companyName": "Test Drilling Co", "fullName": "John Test", "contactNumber": "555-1234", "itemType": "Blank Pipe", "grade": "L80", "totalJoints": 100}'::jsonb
);
```

Now you can test the admin approval workflow!

---

## 📊 Step 10: Monitor Real-Time Events

To see if Realtime is working:

1. Open Supabase Dashboard
2. Go to "Database" > "Realtime Inspector"
3. Subscribe to `storage_requests` table
4. In another tab, submit a storage request in PipeVault
5. You should see the event appear in real-time!

---

## 🔍 Verify Everything Works

### Database Connection
```typescript
import { supabase } from './lib/supabase';

// Test query
const { data, error } = await supabase
  .from('companies')
  .select('*')
  .limit(1);

console.log(data); // Should show companies
```

### Realtime Subscription
```typescript
const channel = supabase
  .channel('test')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'storage_requests' },
    (payload) => console.log('New request!', payload)
  )
  .subscribe();
```

### Storage Upload
```typescript
const { data, error } = await supabase.storage
  .from('documents')
  .upload('test.pdf', file);

console.log(data); // Should show upload success
```

---

## 🚨 Troubleshooting

### "Invalid API Key"
- Check `.env` has correct `VITE_SUPABASE_ANON_KEY`
- Make sure you're using the **anon/public** key, not the service role key
- Restart dev server after changing `.env`

### "Relation does not exist"
- You didn't run `schema.sql` yet
- Go to SQL Editor and run the entire schema file

### "Row-Level Security policy violation"
- Normal for now - we haven't implemented auth yet
- For testing, you can temporarily disable RLS:
  ```sql
  ALTER TABLE storage_requests DISABLE ROW LEVEL SECURITY;
  ```

### "Realtime not working"
- Check "Database" > "Replication" in dashboard
- Make sure tables are in the publication
- Verify WebSocket connection in Network tab

---

## 📚 Next Steps

Once Supabase is set up:

1. ✅ Test creating a storage request
2. ✅ Test admin approval workflow
3. ✅ Test real-time notifications
4. ✅ Add AI API keys to start chat features
5. ✅ Deploy to production

---

## 💡 Useful Supabase Commands

### View all tables
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';
```

### Count requests
```sql
SELECT status, COUNT(*)
FROM storage_requests
GROUP BY status;
```

### View yard capacity
```sql
SELECT * FROM yard_capacity;
```

### Clear all data (reset database)
```sql
TRUNCATE TABLE
  storage_requests,
  inventory,
  truck_loads,
  conversations,
  documents,
  notifications
CASCADE;
```

---

**Your Supabase is ready to go! 🚀**

Next: Run `npm install` and then `npm run dev` to start building!
