# Deploy React App to Wix - Complete Guide

This guide shows you how to deploy the PipeVault React app to your Wix site using GitHub.

---

## 🚀 Deployment Options

### Option 1: Embed React App in Wix (RECOMMENDED)

**This approach:**
- Keeps your React code
- Uses Wix Data Collections for backend
- Embeds the app as a Custom Element
- Pulls automatically from GitHub

### Option 2: Full Wix Native
- See `/wix/README.md` for converting to native Wix pages

---

## 📋 Prerequisites

- Wix Premium Plan (for Velo)
- GitHub account
- Claude API key
- Gemini API key (optional)

---

## 🔧 Step-by-Step Setup

### Step 1: Push to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Wix-ready PipeVault app"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/pipevault.git
git push -u origin main
```

### Step 2: Enable GitHub Pages (Free Hosting)

1. Go to your GitHub repo
2. **Settings** → **Pages**
3. Source: **GitHub Actions**
4. This will host your built React app for free

### Step 3: Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_GITHUB_PAGES: 'true'

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
```

### Step 4: Update Vite Config for GitHub Pages

Already configured! The `vite.config.ts` will automatically use the correct base path.

### Step 5: Set Up Wix Data Collections

In your Wix Editor:

1. **Enable Velo** (Dev Mode → Enable Velo)

2. **Create Collections** (Database → New Collection):

#### Companies
```
Collection ID: Companies
Permissions: Site Content

Fields:
- name (Text)
- domain (Text)
```

#### StorageRequests
```
Collection ID: StorageRequests
Permissions: Site Content

Fields:
- companyId (Text)
- userId (Text)
- referenceId (Text)
- status (Text)
- requestDetails (Object)
- truckingInfo (Object)
- approvalSummary (Text)
- assignedLocation (Text)
- assignedRackIds (Text)
- rejectionReason (Text)
```

#### Inventory
```
Collection ID: Inventory
Permissions: Site Content

Fields:
- companyId (Text)
- referenceId (Text)
- rackId (Text)
- status (Text)
- pipeData (Object)
- pickUpTimestamp (Date)
```

### Step 6: Add Wix Backend Code

**Backend** → **New Web Module** → `wixData.jsw`

Copy from `/wix/backend/data.jsw`

**Backend** → **New Web Module** → `aiService.jsw`

Copy from `/wix/backend/ai.jsw`

### Step 7: Add API Keys to Wix Secrets

**Secrets Manager** → Add:
- `ANTHROPIC_API_KEY`: Your Claude key
- `GOOGLE_AI_API_KEY`: Your Gemini key

### Step 8: Embed React App in Wix

#### Create Full-Page Embed

1. **Add Page** → Blank page → Name it "PipeVault"

2. **Add Element** → **Embed** → **Custom Element**

3. **Set Tag Name**: `pipevault-app`

4. **Add Custom Code** to page:

```html
<script type="module">
  import { createApp } from 'https://YOUR-USERNAME.github.io/pipevault/assets/index.js';

  class PipeVaultApp extends HTMLElement {
    connectedCallback() {
      // Mount React app
      this.innerHTML = '<div id="root"></div>';

      // Configure to use Wix backend
      window.PIPEVAULT_CONFIG = {
        useWixBackend: true,
        wixSiteUrl: window.location.origin
      };

      // Load app
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://YOUR-USERNAME.github.io/pipevault/assets/index.js';
      document.head.appendChild(script);
    }
  }

  customElements.define('pipevault-app', PipeVaultApp);
</script>

<pipevault-app></pipevault-app>
```

5. **Adjust Settings**:
   - Width: 100%
   - Height: 100vh (or fixed height)

### Step 9: Connect React App to Wix Data

The app will automatically detect it's running in Wix and use Wix Data API instead of Supabase.

This is handled by the `WixDataAdapter` (see Step 10).

### Step 10: Update React Code for Wix

I'll create the adapter files now...

---

## 🔄 Alternative: Use Wix CLI (Advanced)

If you prefer tighter integration:

```bash
# Install Wix CLI
npm install -g @wix/cli

# Login
wix login

# Create Wix site integration
wix create

# Deploy
wix deploy
```

See Wix Blocks documentation for building custom React components.

---

## 📱 Testing

1. **Preview** your Wix site
2. Navigate to the PipeVault page
3. Test all functionality:
   - [ ] 4 cards load
   - [ ] Form submission works
   - [ ] AI chatbot responds
   - [ ] Data saves to Wix Collections
   - [ ] Reference ID provided

---

## 🔧 Troubleshooting

**React app not loading:**
- Check GitHub Pages is enabled
- Verify the URL in custom element code
- Check browser console for errors

**Wix Data not working:**
- Verify collections are created with correct IDs
- Check permissions (Site Content)
- Ensure backend modules are saved

**AI not responding:**
- Check Secrets Manager has keys
- Verify backend module imports
- Check console for API errors

---

## 📊 Architecture

```
GitHub Repo (Your React Code)
       ↓
GitHub Actions (Auto-build on push)
       ↓
GitHub Pages (Hosts built files)
       ↓
Wix Custom Element (Embeds app)
       ↓
Wix Data Collections (Database)
       ↓
Wix Backend (.jsw files for AI)
```

**Data Flow:**
1. User interacts with React app (embedded in Wix)
2. App detects Wix environment
3. Uses Wix Data Adapter to call Wix backend
4. Backend saves to Wix Collections
5. AI calls go through Wix backend (secure)

---

## 🎯 Next Steps

I'll now create:
1. ✅ GitHub Actions workflow
2. ✅ Wix Data Adapter for React
3. ✅ Environment detection
4. ✅ Updated build config

Let me create these files...
