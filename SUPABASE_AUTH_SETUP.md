# Supabase Authentication Setup Guide

This guide walks you through setting up Supabase Auth with Email, Google, Apple, and Microsoft sign-in.

---

## 🎯 Overview

We'll configure:
- ✅ Email/Password authentication
- ✅ Google OAuth
- ✅ Apple OAuth
- ✅ Microsoft OAuth
- ✅ Admin role management

---

## Step 1: Enable Email Authentication

1. Go to your **Supabase Dashboard**: https://app.supabase.com
2. Select your **PipeVault project**
3. Navigate to **Authentication** → **Providers**
4. **Email** should already be enabled by default
5. Configure settings:
   - ✅ Enable email confirmations (recommended)
   - ✅ Enable auto-confirm for testing (optional)

---

## Step 2: Configure Google OAuth

### A. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Application type: **Web application**
6. Name: `PipeVault`

7. **Authorized redirect URIs** - Add these:
   ```
   https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
   ```
   Replace `YOUR-PROJECT-REF` with your Supabase project reference (found in Supabase dashboard URL)

8. Click **Create**
9. Copy your **Client ID** and **Client Secret**

### B. Add to Supabase

1. Back in **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **Google** and enable it
3. Paste your **Client ID** and **Client Secret**
4. Click **Save**

---

## Step 3: Configure Apple OAuth

### A. Get Apple OAuth Credentials

1. Go to [Apple Developer](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** (Add new)
4. Select **App IDs** → **Continue**
5. Register an App ID:
   - Description: `PipeVault`
   - Bundle ID: `com.mpsgroup.pipevault`
   - Enable **Sign in with Apple**

6. Create a **Services ID**:
   - Description: `PipeVault Web`
   - Identifier: `com.mpsgroup.pipevault.web`
   - Enable **Sign in with Apple**
   - Configure:
     - Primary App ID: (select the one you just created)
     - Return URLs:
       ```
       https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
       ```

7. Create a **Key** for Sign in with Apple:
   - Keys → **+** (Add new)
   - Key Name: `PipeVault Auth Key`
   - Enable **Sign in with Apple**
   - Configure: Select your Primary App ID
   - Download the `.p8` key file (you can only do this once!)
   - Note the **Key ID**

### B. Add to Supabase

1. **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **Apple** and enable it
3. Enter:
   - **Services ID**: `com.mpsgroup.pipevault.web`
   - **Key ID**: (from Apple Developer)
   - **Secret Key**: (paste contents of `.p8` file)
4. Click **Save**

---

## Step 4: Configure Microsoft OAuth

### A. Get Microsoft OAuth Credentials

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Microsoft Entra ID** (formerly Azure AD)
3. **App registrations** → **New registration**
4. Name: `PipeVault`
5. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
6. Redirect URI:
   - Platform: **Web**
   - URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
7. Click **Register**

8. Copy the **Application (client) ID**

9. Create a client secret:
   - **Certificates & secrets** → **New client secret**
   - Description: `PipeVault Auth`
   - Expires: 24 months (or custom)
   - Click **Add**
   - Copy the **Value** (secret) immediately (you won't see it again!)

### B. Add to Supabase

1. **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **Microsoft** and enable it (might be called "Azure")
3. Enter:
   - **Client ID**: (Application ID from Azure)
   - **Client Secret**: (from Azure)
4. Click **Save**

---

## Step 5: Set Up Admin Roles

### A. Create Admin Table (Option 1 - Separate Table)

Run this SQL in Supabase SQL Editor:

```sql
-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin_users table
CREATE POLICY "Only admins can view admin_users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Only admins can insert/update/delete admin_users
CREATE POLICY "Only admins can modify admin_users"
  ON admin_users FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.user_id = is_admin.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add your first admin (replace with your email)
INSERT INTO admin_users (user_id, email)
SELECT id, email FROM auth.users WHERE email = 'your-admin-email@example.com'
ON CONFLICT (email) DO NOTHING;
```

### B. Or Use User Metadata (Option 2 - Simpler)

Run this SQL to add admin role to a user:

```sql
-- Update user metadata to mark as admin
UPDATE auth.users
SET raw_app_meta_data =
  raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'your-admin-email@example.com';
```

Then check admin status in your app:
```typescript
const { data: { user } } = await supabase.auth.getUser();
const isAdmin = user?.app_metadata?.role === 'admin';
```

---

## Step 6: Configure Redirect URLs

### For Local Development

Add to Supabase **Authentication** → **URL Configuration**:

**Site URL**: `http://localhost:3000`

**Redirect URLs** (add all these):
```
http://localhost:3000
http://localhost:3000/auth/callback
https://bushels.github.io/PipeVault/
https://bushels.github.io/PipeVault/auth/callback
https://your-wix-site.wixsite.com/pipevault
https://your-wix-site.wixsite.com/pipevault/auth/callback
```

---

## Step 7: Test Authentication

### Test Email/Password
1. Run your app
2. Click "Sign up with Email"
3. Enter email and password
4. Check email for confirmation link (if enabled)
5. Should redirect back to app

### Test OAuth Providers
1. Click "Sign in with Google/Apple/Microsoft"
2. Authorize the app
3. Should redirect back to app
4. Check Supabase Dashboard → Authentication → Users

---

## 🔒 Security Best Practices

1. **Enable Email Confirmation** (production)
2. **Set up rate limiting** in Supabase
3. **Configure password requirements**
4. **Enable MFA** (Multi-Factor Authentication) for admins
5. **Use separate admin accounts** (don't use personal email)
6. **Regularly rotate OAuth secrets**
7. **Monitor auth logs** in Supabase

---

## 📱 Mobile Apps (Future)

If you build a mobile app, add these to OAuth providers:

**iOS Deep Link:**
```
pipevault://auth/callback
```

**Android Deep Link:**
```
com.mpsgroup.pipevault://auth/callback
```

---

## 🐛 Troubleshooting

**"Invalid redirect URI"**
- Check URLs match exactly in OAuth provider console
- Ensure all URLs end without trailing slash

**"Access denied"**
- Check OAuth app is not in testing mode
- Add test users if in testing mode

**"Email not confirmed"**
- Disable email confirmation for testing
- Or click confirmation link in email

**Admin login not working**
- Verify user exists in `admin_users` table or has `role: admin` metadata
- Check SQL query returns true for `is_admin()` function

---

## ✅ Checklist

Before going live:

- [ ] Google OAuth configured and tested
- [ ] Apple OAuth configured and tested (if supporting iOS users)
- [ ] Microsoft OAuth configured and tested
- [ ] Email confirmation enabled
- [ ] Admin roles set up
- [ ] All redirect URLs added
- [ ] Rate limiting configured
- [ ] Test on all platforms (web, mobile if applicable)
- [ ] Security policies reviewed

---

**Next Step:** Use the Auth components in your React app (see implementation in `/lib/AuthContext.tsx`)
