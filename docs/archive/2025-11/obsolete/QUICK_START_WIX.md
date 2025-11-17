# Quick Start - Deploy to Wix in 10 Steps

**Get PipeVault running on your Wix site in 15 minutes!**

---

## ✅ Checklist

### Part 1: GitHub Setup (5 minutes)

- [ ] **1. Create GitHub repo** named `PipeVault` (public)

- [ ] **2. Push code to GitHub:**
  ```bash
  git init
  git add .
  git commit -m "PipeVault for Wix"
  git remote add origin https://github.com/YOUR-USERNAME/PipeVault.git
  git push -u origin main
  ```

- [ ] **3. Enable GitHub Pages:**
  - Repo → Settings → Pages
  - Source: **GitHub Actions**
  - Wait 2-5 minutes for deployment

- [ ] **4. Verify deployment:**
  - Visit: `https://YOUR-USERNAME.github.io/PipeVault/`
  - Should see 4 colorful cards

---

### Part 2: Wix Setup (10 minutes)

- [ ] **5. Enable Velo in Wix:**
  - Wix Editor → Dev Mode → Turn on Dev Mode

- [ ] **6. Embed React app:**
  - Add Elements → Embed Code → HTML iframe
  - Paste this code:
    ```html
    <iframe
      src="https://YOUR-USERNAME.github.io/PipeVault/"
      style="width:100%; height:100vh; border:none;"
      title="PipeVault">
    </iframe>
    ```
  - Replace `YOUR-USERNAME` with your GitHub username!

- [ ] **7. Create Wix Data Collections:**
  - Database → New Collection → **Companies**
    - Fields: `name` (Text), `domain` (Text)
  - New Collection → **StorageRequests**
    - Fields: `referenceId` (Text), `companyId` (Text), `userId` (Text), `status` (Text), `requestDetails` (Text), `truckingInfo` (Text), `approvalSummary` (Text)
  - New Collection → **Inventory**
    - Fields: `rackId` (Text), `companyId` (Text), `referenceId` (Text), `status` (Text), `pipeData` (Text)

- [ ] **8. Add backend code:**
  - Backend → New Web Module → `ai.jsw`
  - Copy from `/wix/backend/ai.jsw`
  - New Web Module → `data.jsw`
  - Copy from `/wix/backend/data.jsw`

- [ ] **9. Add API keys:**
  - Secrets Manager → New Secret
  - Name: `ANTHROPIC_API_KEY`, Value: your Claude key
  - Name: `GOOGLE_AI_API_KEY`, Value: your Gemini key

- [ ] **10. Test & Publish:**
  - Preview site
  - Test form submission
  - Test AI chatbot
  - Publish when ready!

---

## 🎉 Done!

Your PipeVault app is now live on Wix!

### Next Steps:

- **Make changes?** Edit code → commit → push to GitHub (auto-deploys in 2-5 min)
- **Custom domain?** GitHub Pages Settings → Custom domain
- **Need help?** See `DEPLOY_TO_WIX.md` for detailed guide

---

## 📞 Troubleshooting

**App not loading?**
- Check GitHub Actions completed successfully (green ✅)
- Verify iframe `src` URL matches your GitHub Pages URL
- Hard refresh: Ctrl+Shift+R

**Wix Data not working?**
- Verify collection names match exactly (case-sensitive)
- Check backend modules are saved
- Check Secrets Manager has API keys

---

## 📁 File Structure

```
PipeVault/
├── QUICK_START_WIX.md ← You are here
├── DEPLOY_TO_WIX.md ← Detailed guide
├── .github/
│   └── workflows/
│       └── deploy.yml ← Auto-deployment
├── wix/
│   ├── backend/
│   │   ├── ai.jsw ← Copy to Wix
│   │   └── data.jsw ← Copy to Wix
│   └── README.md
└── ... (React app files)
```

---

**Ready to deploy? Follow the checklist above!** ✨
