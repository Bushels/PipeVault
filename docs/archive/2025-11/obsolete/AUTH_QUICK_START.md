# Supabase Authentication - Quick Start

Your PipeVault app now uses Supabase Authentication with Email, Google, Apple, and Microsoft sign-in!

## What Changed

1. **Users must authenticate** - The app now shows a beautiful login screen first
2. **OAuth providers** - Users can sign in with Google, Apple, or Microsoft
3. **Email/Password** - Users can also create accounts with email
4. **Admin access** - Admins authenticate through Supabase (no more URL parameter login)

## Next Steps

### Step 1: Test Locally

Run the app locally to see the new authentication:

```bash
npm run dev
```

You should see the new Auth screen with OAuth buttons!

### Step 2: Set Up OAuth Providers (Required for Production)

To enable Google, Apple, and Microsoft sign-in, you need to configure them in Supabase:

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Select your PipeVault project**
3. **Navigate to Authentication → Providers**
4. **Follow the detailed setup guide**: See `SUPABASE_AUTH_SETUP.md` for step-by-step instructions

### Step 3: Set Up Admin Access

Choose one of these methods:

#### Option 1: User Metadata (Simpler)

Run this SQL in Supabase SQL Editor:

```sql
-- Make yourself an admin (replace with your email)
UPDATE auth.users
SET raw_app_meta_data =
  raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'your-admin-email@example.com';
```

#### Option 2: Admin Table (More Secure)

See `SUPABASE_AUTH_SETUP.md` Step 5 for creating an `admin_users` table.

### Step 4: Configure Redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**, add:

**Site URL**:
```
https://bushels.github.io/PipeVault/
```

**Redirect URLs** (add all these):
```
https://bushels.github.io/PipeVault/
https://bushels.github.io/PipeVault/auth/callback
http://localhost:5173
http://localhost:5173/auth/callback
```

If you're embedding in Wix, also add your Wix site URL.

## Testing

### Test Email/Password

1. Click "Sign Up"
2. Enter email and password (minimum 6 characters)
3. Check your email for confirmation link
4. Click confirmation link
5. You should be logged in and see the 4-card menu!

### Test OAuth (After Setup)

1. Click "Continue with Google" (or Apple/Microsoft)
2. Authorize the app
3. You should be redirected back and logged in!

### Test Admin Access

1. Make sure you've set up admin access (Step 3 above)
2. Sign in with your admin email
3. You should see the Admin Dashboard instead of the 4-card menu

## How It Works

### Authentication Flow

```
User visits site
     ↓
Not authenticated? → Show Auth component (login/signup)
     ↓
User signs in (email or OAuth)
     ↓
Authenticated? → Check if admin
     ↓
Admin? → Admin Dashboard
     ↓
Regular user? → WelcomeScreen (4-card menu)
```

### File Changes

- **index.tsx** - Wrapped app with AuthProvider
- **App.tsx** - Uses useAuth hook, shows Auth component when not logged in
- **components/Auth.tsx** - New beautiful login screen with OAuth
- **lib/AuthContext.tsx** - Manages authentication state
- **WelcomeScreen.tsx** - Removed old admin login code

## Troubleshooting

**"Invalid login credentials"**
- Make sure you've confirmed your email (check inbox)
- Password must be at least 6 characters

**"Email not confirmed"**
- Check your email for confirmation link
- Or disable email confirmation in Supabase (for testing)

**OAuth buttons don't work**
- You need to configure OAuth providers in Supabase first
- See `SUPABASE_AUTH_SETUP.md` for detailed instructions

**Admin access not working**
- Make sure you've run the SQL to set admin role
- Sign out and sign back in
- Check Supabase Dashboard → Authentication → Users → User Details → Raw App Meta Data

**Can't see app after login**
- Make sure redirect URLs are configured correctly
- Check browser console for errors

## Production Deployment

Before deploying to production:

1. ✅ Configure all OAuth providers
2. ✅ Enable email confirmation
3. ✅ Set up admin roles
4. ✅ Add all production URLs to redirect list
5. ✅ Test authentication flow thoroughly
6. ✅ Review Supabase security policies (RLS)

## Support

- **Detailed OAuth Setup**: See `SUPABASE_AUTH_SETUP.md`
- **Supabase Docs**: https://supabase.com/docs/guides/auth
- **OAuth Provider Docs**:
  - Google: https://console.cloud.google.com
  - Apple: https://developer.apple.com
  - Microsoft: https://portal.azure.com

---

**Ready to push to GitHub?**

```bash
git add .
git commit -m "feat: Integrate Supabase Auth with OAuth providers"
git push
```

Your GitHub Pages site will automatically update with the new authentication!
