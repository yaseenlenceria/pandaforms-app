# PandaForms Shopify App Development & Deployment Workflow

This document outlines the workflow for developing, deploying, and monitoring the **PandaForms** Shopify application.

---

## 🚀 The Development & Deployment Loop

Your application uses a Git-triggered continuous deployment setup:
1. **Make Changes**: Modify the code in the codebase locally or via the agent.
2. **Push to GitHub**: Push the commits to the remote repository.
3. **Automated Build & Deploy**: Northflank detects the new commits on `main` and automatically builds and deploys the app.
4. **Live Shopify Verification**: Once deployed, the app updates live inside the Shopify merchants' admin stores where it is installed.

---

## 🛠️ Step-by-Step Workflow Guide

### 1. Workspace Configuration
Before beginning any coding work, make sure your IDE has the project root set as the active workspace:
* **Active Workspace Path**: `C:\Users\Seenu\.gemini\antigravity\scratch\pandaforms-app`

### 2. Making and Committing Changes
When you want to implement a new feature, fix a bug, or resolve health issues:
1. Make the necessary code edits in the `app/` or `extensions/` directories.
2. Run standard git checks to review modified files:
   ```powershell
   git status
   git diff
   ```
3. Commit your changes:
   ```powershell
   git add .
   git commit -m "Describe the feature or fix here"
   ```

### 3. Deploying ("Push to GitHub")
When you are ready to deploy, tell the agent **"push to github"** or run:
```powershell
git push origin main
```
This push acts as the release trigger.

### 4. Monitoring the Deployment
Once pushed, Northflank immediately starts building your app.
* **Builds Dashboard**: [Northflank Builds Console](https://app.northflank.com/t/seenu92s-team/project/pandaform/services/pandaforms-app/builds)
* **Action**: Visit this link to ensure the build completes without errors. If the build fails, check the logs in the console to diagnose issues.

### 5. Live Testing on Shopify
Once the build is marked as successful on Northflank, the live application will run the updated version at:
* **Live App URL**: [https://p01--pandaforms-app--77wd8gj6rv7k.code.run](https://p01--pandaforms-app--77wd8gj6rv7k.code.run)
* **Verification**: Open the Shopify admin of the development store/installed test store where PandaForms is installed and test the live features (e.g. check the form embedding, configurations, admin pages, etc.).

### 6. Monitoring API Health & Errors
To ensure Shopify is communicating correctly with the app (e.g. webhooks, API requests, session validation):
* **API Health & Webhook Monitoring**: [Shopify Partner Dashboard - API Health](https://dev.shopify.com/dashboard/130056835/apps/379465400321/monitoring/api_health)
* **Action**: Check this page periodically to:
  * Detect failed webhook delivery.
  * Identify API rate limit issues.
  * Spot deprecated API usage warnings.

---

## 📂 Key Project Resources

* **GitHub Repository**: [yaseenlenceria/pandaforms-app](https://github.com/yaseenlenceria/pandaforms-app)
* **Northflank Builds**: [Services Builds](https://app.northflank.com/t/seenu92s-team/project/pandaform/services/pandaforms-app/builds)
* **Shopify API Health**: [Monitoring Dashboard](https://dev.shopify.com/dashboard/130056835/apps/379465400321/monitoring/api_health)
* **Shopify App Config**: [shopify.app.toml](file:///C:/Users/Seenu/.gemini/antigravity/scratch/pandaforms-app/shopify.app.toml)
