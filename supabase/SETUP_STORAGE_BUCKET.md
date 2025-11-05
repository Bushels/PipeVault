# Supabase Storage Bucket Setup

## Issue: "Bucket not found" Error When Uploading Documents

**Error Message:**
```
Failed to save delivery: Error: Bucket not found
```

This error occurs when trying to upload shipping manifests or trucking documents because the 'documents' storage bucket hasn't been created in Supabase Storage.

---

## Solution: Create the 'documents' Storage Bucket

### Step 1: Navigate to Storage

1. Open your **Supabase Dashboard**
2. Go to **Storage** in the left sidebar
3. Click **"New bucket"** button

### Step 2: Create the Bucket

**Bucket Configuration:**
- **Name:** `documents`
- **Public:** ❌ **OFF** (Private bucket for security)
- **File size limit:** `52428800` (50 MB)
- **Allowed MIME types:** Leave empty (allows all file types)

Click **"Save"** to create the bucket.

### Step 3: Configure RLS Policies

After creating the bucket, set up Row Level Security policies to control access.

#### Policy 1: Allow Authenticated Users to Upload

```sql
-- Policy: Authenticated users can upload documents
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');
```

#### Policy 2: Allow Authenticated Users to View Their Documents

```sql
-- Policy: Authenticated users can view documents
CREATE POLICY "Authenticated users can view documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents');
```

#### Policy 3: Allow Admin Users to View All Documents

```sql
-- Policy: Admin users can view all documents
CREATE POLICY "Admin users can view all documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    auth.jwt() ->> 'email' IN (
      'admin@mpsgroup.com',
      'kyle@bushels.com',
      'admin@bushels.com',
      'kylegronning@mpsgroup.ca'
    )
    OR
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
);
```

#### Policy 4: Allow Admin Users to Delete Documents

```sql
-- Policy: Admin users can delete documents
CREATE POLICY "Admin users can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    auth.jwt() ->> 'email' IN (
      'admin@mpsgroup.com',
      'kyle@bushels.com',
      'admin@bushels.com',
      'kylegronning@mpsgroup.ca'
    )
    OR
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
);
```

### Step 4: Verify Bucket Creation

Run this SQL query to confirm the bucket exists:

```sql
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE name = 'documents';
```

**Expected Result:**
```
id       | name      | public | file_size_limit | allowed_mime_types | created_at
---------|-----------|--------|-----------------|--------------------|-----------
documents| documents | false  | 52428800        | NULL               | [timestamp]
```

### Step 5: Test Document Upload

1. Go to your PipeVault application
2. Navigate to **Schedule Delivery to MPS**
3. Upload a test manifest PDF
4. Verify the upload completes without "Bucket not found" error

---

## Bucket Structure

Documents are organized in the following folder structure:

```
documents/
├── trucking_loads/
│   ├── {load_id}/
│   │   ├── {timestamp}_{filename}.pdf
│   │   └── {timestamp}_{filename}.pdf
│   └── ...
├── shipments/
│   ├── {shipment_id}/
│   │   ├── manifests/
│   │   │   └── {timestamp}_{filename}.pdf
│   │   └── photos/
│   │       └── {timestamp}_{filename}.jpg
│   └── ...
└── storage_requests/
    ├── {request_id}/
    │   └── {timestamp}_{filename}.pdf
    └── ...
```

---

## File Path Format

When uploading documents, use this path format:

```typescript
const uploadPath = `trucking_loads/${loadId}/${Date.now()}_${file.name}`;
```

This ensures:
- ✅ Files are organized by load/shipment ID
- ✅ Filenames are unique (timestamp prefix)
- ✅ Original filename is preserved for user reference

---

## Troubleshooting

### Issue: Still Getting "Bucket not found"

**Check bucket name spelling:**
```sql
SELECT name FROM storage.buckets;
```

The bucket must be named exactly `documents` (lowercase, plural).

### Issue: Upload Works But Can't View Documents

**Check RLS policies:**
```sql
SELECT
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';
```

You should see at least 2 policies (INSERT and SELECT for authenticated users).

### Issue: Admin Can't Delete Documents

**Add admin delete policy** (see Policy 4 above)

---

## Security Considerations

1. **Never make the bucket public** - Documents may contain sensitive pipe inventory data
2. **Use RLS policies** to restrict access to authenticated users
3. **Verify user company_id** when fetching documents (additional application-level security)
4. **Set file size limits** to prevent abuse (50 MB max recommended)
5. **Consider signed URLs** with expiration for document downloads

---

## Additional Configuration (Optional)

### Enable File Preview in Dashboard

To preview PDFs and images directly in the Supabase Dashboard:

1. Go to **Storage** → **documents** bucket
2. Click **Settings** (gear icon)
3. Enable **"Allow file preview"**

### Set Up Automatic Cleanup

To automatically delete old documents after 90 days:

```sql
-- Create a scheduled job to clean up old documents
-- (Requires pg_cron extension)
SELECT cron.schedule(
  'cleanup-old-documents',
  '0 2 * * *', -- Run at 2 AM daily
  $$
  DELETE FROM storage.objects
  WHERE bucket_id = 'documents'
    AND created_at < NOW() - INTERVAL '90 days';
  $$
);
```

---

**Last Updated:** 2025-11-05
**Document Maintained By:** Development Team
