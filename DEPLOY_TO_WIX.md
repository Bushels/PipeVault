# Deploy PipeVault React App to Wix - Simple Method

**The easiest way to get your React app running on Wix!**

---

## 🎯 Overview

This guide shows you how to:
1. Push your code to GitHub
2. Auto-deploy to GitHub Pages (free hosting)
3. Embed in Wix using an iframe
4. Connect to Wix Data Collections

**Total Time: 15-30 minutes**

---

## 📋 Prerequisites

- [x] GitHub account
- [x] Wix site with Premium plan (for Velo)
- [x] Claude API key
- [x] Gemini API key (optional - has free tier)

---

## 🚀 Part 1: Deploy to GitHub Pages

### Step 1: Create GitHub Repository

1. Go to [github.com](https://github.com)
2. Click **New Repository**
3. Name it: `PipeVault`
4. Make it **Public** (required for GitHub Pages)
5. Click **Create Repository**

### Step 2: Push Your Code

Open terminal in your PipeVault folder:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - PipeVault for Wix"

# Add remote (replace YOUR-USERNAME)
git remote add origin https://github.com/YOUR-USERNAME/PipeVault.git

# Push to GitHub
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repo on GitHub
2. Click **Settings**
3. Click **Pages** (left sidebar)
4. Under "Build and deployment":
   - Source: **GitHub Actions**
5. That's it! The workflow will run automatically

### Step 4: Wait for Deployment

1. Click **Actions** tab in your repo
2. Watch the "Deploy to GitHub Pages" workflow
3. Wait for green checkmark (✅) - takes 2-5 minutes
4. Your app will be live at:
   ```
   https://YOUR-USERNAME.github.io/PipeVault/
   ```

---

## 🌐 Part 2: Embed in Wix

### Step 5: Add HTML Embed to Wix

1. Open your Wix Editor
2. Click **(+) Add Elements**
3. Search for **"HTML iframe"** or **"Embed Code"**
4. Drag the **HTML Embed** element to your page
5. Make it full-width and full-height

### Step 6: Configure the Embed

Click the embed element → **Settings** →  **Code**:

```html
<iframe
  src="https://YOUR-USERNAME.github.io/PipeVault/"
  style="width: 100%; height: 100vh; border: none;"
  allow="clipboard-write"
  title="PipeVault App">
</iframe>
```

**Replace `YOUR-USERNAME` with your actual GitHub username!**

### Step 7: Adjust Embed Settings

- **Width**: 100% or Stretch
- **Height**: 100% of viewport or fixed (e.g., 1000px)
- **Position**: Top of page
- **Margins**: Remove all

---

## 🗄️ Part 3: Set Up Wix Data (Backend)

### Step 8: Enable Velo

1. In Wix Editor, click **Dev Mode** (top menu)
2. Click **Turn on Dev Mode**
3. This enables Velo (Wix's backend)

### Step 9: Create Data Collections

Click **Database** (left sidebar) → **Add a Collection**:

#### Collection 1: Companies

```
Collection ID: Companies
Permissions: Site member created content

Fields:
✓ Title → Rename to: name (Text)
+ Add Field: domain (Text)
```

#### Collection 2: StorageRequests

```
Collection ID: StorageRequests
Permissions: Site member created content

Fields:
✓ Title → Rename to: referenceId (Text)
+ Add Field: companyId (Text)
+ Add Field: userId (Text)
+ Add Field: status (Text)
+ Add Field: requestDetails (Text) *large text
+ Add Field: truckingInfo (Text) *large text
+ Add Field: approvalSummary (Text) *large text
+ Add Field: assignedLocation (Text)
+ Add Field: rejectionReason (Text)
```

**Note:** Wix doesn't have native JSON fields, so we store JSON as text.

#### Collection 3: Inventory

```
Collection ID: Inventory
Permissions: Site member created content

Fields:
✓ Title → Rename to: rackId (Text)
+ Add Field: companyId (Text)
+ Add Field: referenceId (Text)
+ Add Field: status (Text)
+ Add Field: pipeData (Text) *large text - stores JSON
+ Add Field: pickUpTimestamp (Date & Time)
```

### Step 10: Add Backend Functions

**Backend** folder (left sidebar) → **New Web Module** → Name it `data.jsw`

Copy the entire contents from `/wix/backend/data.jsw`

**Create another module** → `ai.jsw`

Copy from `/wix/backend/ai.jsw`

### Step 11: Add API Keys Securely

1. **Velo Sidebar** → Click **Secrets Manager** icon
2. Click **New Secret**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `your-claude-api-key-here`
3. Add another secret:
   - Name: `GOOGLE_AI_API_KEY`
   - Value: `your-gemini-api-key-here`

---

## 🔗 Part 4: Connect React App to Wix (Optional)

Currently, your React app uses Supabase. To use Wix Data Collections instead:

### Option A: Keep Using Supabase (Easiest)

No changes needed! Your embedded app continues using Supabase.

**Pros:**
- Zero code changes
- Works immediately
- All features work

**Cons:**
- Need to maintain Supabase account
- Two separate databases

### Option B: Switch to Wix Data (Advanced)

Update React app to call Wix backend functions via HTTP:

```typescript
// In your React app
async function submitRequest(data) {
  // Call Wix backend function
  const response = await fetch('https://YOUR-SITE.wix.com/_functions/submitRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}
```

This requires creating HTTP Functions in Wix (see `/wix/WIX_MIGRATION_GUIDE.md`).

---

## ✅ Testing Your Deployment

### Test GitHub Pages

1. Visit: `https://YOUR-USERNAME.github.io/PipeVault/`
2. You should see the 4 option cards
3. Test the form

### Test Wix Embed

1. Click **Preview** in Wix Editor
2. Navigate to the page with embedded app
3. Test all functionality:
   - [ ] 4 cards display
   - [ ] Form loads
   - [ ] AI chatbot works
   - [ ] Form submission works

---

## 🔄 Updating Your App

### Make Changes Locally

```bash
# Make your code changes
# Test locally: npm run dev

# Commit changes
git add .
git commit -m "Update: description of changes"

# Push to GitHub
git push
```

**GitHub Actions automatically rebuilds and deploys!**

Wait 2-5 minutes, then refresh your Wix page - changes will appear.

---

## 🛠️ Troubleshooting

### Problem: App not loading in Wix

**Solutions:**
1. Check iframe `src` URL is correct
2. Verify GitHub Pages is enabled
3. Check GitHub Actions completed successfully (green checkmark)
4. Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Problem: Blank page in GitHub Pages

**Solutions:**
1. Check the base path in `vite.config.ts` matches your repo name
2. Ensure repo is **Public**
3. Check GitHub Actions logs for build errors

### Problem: API keys not working

**Solutions:**
1. Verify keys are in Wix Secrets Manager
2. Check backend modules (`ai.jsw`, `data.jsw`) are saved
3. Ensure secret names match code exactly (case-sensitive)

### Problem: Wix Data not saving

**Solutions:**
1. Verify collections exist with exact names (case-sensitive)
2. Check permissions: "Site member created content"
3. Look at browser console for errors
4. Test backend functions in Wix's testing panel

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│          Your Local Development                 │
│                                                  │
│  Edit Code → Commit → Push to GitHub            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│              GitHub Repository                   │
│                                                  │
│  GitHub Actions Workflow Triggers                │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│            GitHub Pages (Free)                   │
│                                                  │
│  Hosts: https://you.github.io/PipeVault/        │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│         Wix Site (Your Domain)                   │
│                                                  │
│  HTML Embed (iframe) loads GitHub Pages          │
│  ├─ React App renders                            │
│  ├─ Uses Supabase OR Wix Data                   │
│  └─ AI Calls → Wix Backend → Claude/Gemini      │
└──────────────────────────────────────────────────┘
```

---

## 💡 Pro Tips

### Tip 1: Use Environment Variables

In GitHub, you can set secrets:
1. Repo → **Settings** → **Secrets and variables** → **Actions**
2. Add secrets for API keys
3. Reference in GitHub Actions workflow

### Tip 2: Custom Domain

Instead of `github.io`, use your own domain:
1. GitHub Pages Settings → Custom domain
2. Add CNAME record in your DNS
3. Update iframe `src` in Wix

### Tip 3: Faster Updates

Enable **Watch mode** for GitHub Actions:
- Every push auto-deploys
- Takes 2-5 minutes
- No manual intervention needed

### Tip 4: Preview Before Publishing

In Wix:
1. Use **Preview** mode to test changes
2. Only **Publish** when everything works
3. Keep a staging version for testing

---

## 📈 Next Steps

Now that your app is deployed:

1. **Test Everything** - Go through all user flows
2. **Customize Styling** - Match your Wix theme
3. **Add Analytics** - Track usage
4. **Monitor Performance** - Check load times
5. **Gather Feedback** - Ask users for input

---

## 🎓 Additional Resources

- **GitHub Pages Docs**: https://docs.github.com/pages
- **Wix Velo Docs**: https://dev.wix.com/docs/velo
- **Vite Docs**: https://vitejs.dev/guide/
- **React Docs**: https://react.dev/

---

## ✨ You're Done!

Your PipeVault React app is now:
- ✅ Hosted on GitHub Pages (free)
- ✅ Embedded in your Wix site
- ✅ Auto-deploys on every git push
- ✅ Ready for customers to use!

**URL Structure:**
- **Development**: `http://localhost:3000`
- **GitHub Pages**: `https://YOUR-USERNAME.github.io/PipeVault/`
- **Wix Site**: `https://your-site.wixsite.com/your-page`

---

**Questions?** See `/wix/README.md` or `/wix/WIX_MIGRATION_GUIDE.md` for more advanced setups.
