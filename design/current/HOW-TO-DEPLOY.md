# How to deploy N&D Companion

No coding knowledge required. Follow these steps in order.

---

## Part 1 — Create accounts (one time only)

1. Go to **github.com** → click "Sign up" → create a free account
2. Go to **vercel.com** → click "Sign up" → choose "Continue with GitHub" (links both accounts)

---

## Part 2 — Upload the code to GitHub

### Download the project from Figma Make
- In Figma Make, look for a **Download** or **Export** button (top right area)
- It will download a ZIP file to your computer
- Unzip it — you should see a folder with files like `package.json`, `src/`, `index.html`, etc.

### Create a GitHub repository
1. Go to **github.com** and log in
2. Click the **+** icon (top right) → "New repository"
3. Name it: `nd-companion`
4. Leave everything else as default
5. Click **"Create repository"**

### Upload the files
1. On the new repository page, click **"uploading an existing file"** (it's a link in the middle of the page)
2. Drag your entire unzipped project folder into the upload area
   - Make sure you see files like `package.json`, `index.html`, `vercel.json`, and the `src/` folder
   - Do NOT upload the `node_modules` folder — it's huge and not needed
3. Scroll down, click **"Commit changes"**

Your code is now on GitHub.

---

## Part 3 — Deploy to Vercel (get a live URL)

1. Go to **vercel.com** and log in
2. Click **"Add New Project"**
3. Find your `nd-companion` repository in the list → click **"Import"**
4. Vercel will auto-detect all settings (the `vercel.json` file handles this)
5. Click **"Deploy"**
6. Wait ~60 seconds — Vercel will give you a URL like:
   ```
   https://nd-companion-yourname.vercel.app
   ```

**That's your permanent link.** Bookmark it. Open it in a browser tab next to Foundry VTT.

---

## Part 4 — Updating the app in the future

Whenever you ask Figma Make to change something and download a new version:

1. Go to your GitHub repository
2. Navigate to the file that changed (e.g. `src/components/Dashboard.tsx`)
3. Click the file → click the **pencil icon** (Edit) → paste the new content → click "Commit changes"

Vercel will automatically redeploy within ~30 seconds. Your URL stays the same.

---

## Quick reference

| What | Where |
|---|---|
| Your code | github.com/YOUR-USERNAME/nd-companion |
| Your live app | https://nd-companion-xxx.vercel.app |
| Edit campaign data | Ask Figma Make to change it, then re-upload the file |

---

## Troubleshooting

**Deploy failed on Vercel?**
Make sure the `vercel.json` file is in the root of your uploaded folder (not inside a subfolder).

**The app looks broken?**
Make sure you uploaded the `src/` folder and `index.html` — not just the files inside `src/`.

**I want a custom domain (e.g. nd-companion.com)?**
Vercel supports this for free — go to your project settings → Domains → add your domain.
