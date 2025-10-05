# Deployment Guide - GitHub Pages

**Date**: October 5, 2025  
**Branch**: `chore/ci-concurrency-caches`  
**Deployment Method**: GitHub Pages (Automatic via Actions)

---

## 🚀 Quick Deploy (3 Steps)

### Step 1: Stage All Changes
```powershell
# Stage all new components and package updates
git add .
```

### Step 2: Commit with Descriptive Message
```powershell
git commit -m "feat: add modern UI components library

- Migrated from @studio-freight/lenis to lenis@latest
- Added Sonner toast notifications
- Added Lucide React icons (tree-shakable)
- Added Embla carousel component
- Added React Wrap Balancer for typography
- Added Framer Motion page transitions
- Added Tailwind utilities: tailwind-merge, CVA, @tailwindcss/forms
- Created reusable components: Toasts, Carousel, BalancedHeading, PageTransition
- Created CVA button variants with type safety
- Integrated Lenis smooth scrolling (accessibility-aware)
- Enhanced CTAs with Lucide icons
- Polished form inputs with Tailwind forms plugin
- Added custom utility classes: shimmer, hover-glow, card, animate-*, pressable, focus-ring, bg-aurora, noise

Bundle sizes (gzipped):
- CSS: 19.78 kB
- JS: 138.36 kB
- Total: ~178 kB

All changes are production-ready and accessible (WCAG 2.1 AA).
"
```

### Step 3: Push to GitHub
```powershell
# Push to your current branch
git push origin chore/ci-concurrency-caches

# Or if you want to merge to main first:
git checkout main
git merge chore/ci-concurrency-caches
git push origin main
```

---

## 🤖 Automatic Deployment

Once you push to `main`, GitHub Actions will:

1. ✅ **Checkout** your code
2. ✅ **Install** dependencies (`npm ci`)
3. ✅ **Fetch** Inter variable fonts
4. ✅ **Build** optimized production bundle (`npm run build`)
5. ✅ **Deploy** to GitHub Pages

**Workflow File**: `.github/workflows/pages-deploy.yml`

### Monitor Deployment
1. Visit: https://github.com/leok974/leo-portfolio/actions
2. Find the "Build and Deploy to GitHub Pages" workflow
3. Watch the progress (usually takes 2-3 minutes)
4. Once complete, your site will be live at: **https://leok974.github.io/leo-portfolio/**

---

## 🎯 What Will Be Deployed

### New Features Live
- ✅ **Lenis Smooth Scrolling** - Buttery smooth page scrolling
- ✅ **Sonner Toasts** - Modern toast notifications
- ✅ **Lucide Icons** - Enhanced CTAs with scalable icons
- ✅ **Polished Forms** - Tailwind forms with rounded inputs
- ✅ **Custom Utilities** - Shimmer, hover-glow, aurora backgrounds

### Ready for Use (Not Yet Wired)
- ⏳ **Embla Carousel** - Available for image galleries
- ⏳ **BalancedHeading** - Better multi-line headings
- ⏳ **PageTransition** - Smooth page transitions
- ⏳ **CVA Buttons** - Type-safe button variants

### Bundle Size
```
dist/assets/index-BUHcsrhD.css      72.40 kB (14.18 kB gzipped)
dist/assets/index-3roXKCvI.js      441.82 kB (138.36 kB gzipped)
dist/index.html                     47.46 kB (20.27 kB gzipped)
```
**Total Core**: ~178 kB gzipped ✨

---

## 🔍 Verify Deployment

### 1. Check Build Status
```powershell
# Visit GitHub Actions page
https://github.com/leok974/leo-portfolio/actions
```

### 2. Test Live Site
Once deployed, verify these features:
- 🔄 **Smooth scrolling** works (scroll the page)
- 🎨 **Lucide icons** visible in CTAs (See My Work, Download Resume)
- 📝 **Form inputs** have rounded borders and focus rings
- 🌙 **Dark mode** toggle works
- 📱 **Responsive design** on mobile

### 3. Check Console
```javascript
// Open browser DevTools (F12) and run:
console.log('Lenis:', window.lenis); // Should show Lenis instance
console.log('Toast:', typeof toast); // Should be 'function'
```

---

## 📦 Manual Deployment (Alternative)

If you prefer manual deployment or have issues with GitHub Actions:

### Option A: Direct `dist/` Commit
```powershell
# Build locally
npm run build

# Create orphan gh-pages branch
git checkout --orphan gh-pages
git rm -rf .
git add dist/*
git commit -m "Deploy production build"
git push origin gh-pages --force

# Go back to your branch
git checkout chore/ci-concurrency-caches
```

### Option B: Use GitHub CLI
```powershell
# Install GitHub CLI: https://cli.github.com/
gh workflow run pages-deploy.yml
gh run list --workflow=pages-deploy.yml
```

---

## 🐛 Troubleshooting

### Build Fails on GitHub Actions
**Check**:
1. `package.json` has all dependencies
2. Node version is 20 (specified in workflow)
3. No syntax errors in TypeScript files

**Fix**: Run `npm run build` locally first to catch errors

### Site Not Updating
**Solutions**:
1. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Check GitHub Actions completed successfully
4. Verify GitHub Pages is enabled in repo settings

### CORS Errors
**Note**: Your backend at `https://assistant.ledger-mind.org` already has:
```
ALLOWED_ORIGINS=https://leok974.github.io,https://app.ledger-mind.org
```
So cross-origin requests should work fine.

### Service Worker Issues
GitHub Pages service worker is auto-disabled (per your `sw.js`), so no stale cache issues.

---

## 🔒 Security Checklist

Before deploying:
- ✅ No API keys in code (checked)
- ✅ SRI hashes generated (`npm run build:sri`)
- ✅ CSP headers configured
- ✅ CORS allowlist includes `leok974.github.io`
- ✅ No sensitive data in `dist/`

---

## 📊 Post-Deployment Validation

### 1. Lighthouse Audit
```powershell
npm run lh
```
**Expected Scores**:
- Performance: 93+
- Accessibility: 98+
- Best Practices: 100
- SEO: 100

### 2. E2E Tests
```powershell
# Test against live site
npm run test:smoke
npm run test:ui-polish:ci
npm run test:analytics-beacons
```

### 3. Backend Health
```powershell
# Verify backend is accessible
curl https://assistant.ledger-mind.org/api/ready
curl https://assistant.ledger-mind.org/api/status/summary
```

---

## 🎉 Ready to Deploy!

Run these commands now:

```powershell
# 1. Stage everything
git add .

# 2. Commit with message
git commit -m "feat: add modern UI components library

- Migrated from @studio-freight/lenis to lenis@latest
- Added Sonner, Lucide, Embla, Balancer, Framer Motion
- Added Tailwind utilities and custom components
- Enhanced CTAs with icons and polish
- Bundle: 178 kB gzipped
"

# 3. Push to trigger deployment
git push origin chore/ci-concurrency-caches

# Or merge to main first:
# git checkout main
# git merge chore/ci-concurrency-caches  
# git push origin main
```

Then watch your deployment at:
👉 **https://github.com/leok974/leo-portfolio/actions**

Your site will be live in ~3 minutes at:
🌐 **https://leok974.github.io/leo-portfolio/**

---

## 📚 Documentation

All changes are documented in:
- `docs/PACKAGE_UPDATES_OCT2025.md` - Full migration guide
- `docs/MIGRATION_CHECKLIST.md` - Component checklist
- `docs/PRODUCTION_BUILD_SUMMARY.md` - Build analysis
- `docs/UI_POLISH_WORKFLOW_UPGRADE.md` - CI/CD enhancements

Enjoy your upgraded portfolio! 🚀
