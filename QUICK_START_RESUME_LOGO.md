# Quick Start: Resume and Logo Update

## ✅ Completed

1. **Resume PDF** - Added `Leo_Klemet_Resume_2025.pdf` to `apps/portfolio-ui/public/resume/`
   - Size: 5.7KB (optimized!)
   - Format: PDF 1.4
   - Clean 2-page template

## ⏳ Next Step: Save LedgerMind Logo

### Option 1: Manual Save (Recommended)

1. Right-click the LedgerMind logo image in the chat (brain with arrows)
2. Save as: `d:\leo-portfolio\apps\portfolio-ui\public\assets\ledgermind-logo.png`
3. Run the helper script:
   ```powershell
   .\scripts\save-ledgermind-logo.ps1
   ```

### Option 2: Using Script

```powershell
# Run the helper script - it will wait for you to save the file
cd d:\leo-portfolio
.\scripts\save-ledgermind-logo.ps1
```

The script will:
- Wait for logo file to appear
- Verify it's a valid PNG
- Optionally update `projects.json` automatically

## After Logo is Saved

```powershell
# 1. Verify the logo file exists
Test-Path "apps\portfolio-ui\public\assets\ledgermind-logo.png"

# 2. Build portfolio
pnpm build:portfolio

# 3. Test locally
npx serve apps/portfolio-ui/dist-portfolio
# Open: http://localhost:3000

# 4. Run image tests
npx playwright test tests/e2e/portfolio/projects.images.spec.ts

# 5. Deploy when ready
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

## What the Logo Looks Like

The LedgerMind logo you provided features:
- 🧠 Brain icon in the center
- 🔷 Radiating geometric arrows
- 🎨 Cyan/green color scheme on dark background
- 📝 "LedgerMind" text below

## File Locations

```
apps/portfolio-ui/public/
├── assets/
│   └── ledgermind-logo.png        ← Save logo here
└── resume/
    └── Leo_Klemet_Resume_2025.pdf ← Already saved ✅
```

## Access URLs (after deployment)

- **Resume**: https://www.leoklemet.com/resume/Leo_Klemet_Resume_2025.pdf
- **Logo**: Displayed on LedgerMind project card at https://www.leoklemet.com/

## Troubleshooting

**Logo not showing?**
- Check file exists: `Test-Path "apps\portfolio-ui\public\assets\ledgermind-logo.png"`
- Verify PNG format: File should start with bytes `89 50 4E 47`
- Check projects.json: Should reference `"thumbnail": "assets/ledgermind-logo.png"`
- Clear browser cache: Ctrl+Shift+R

**Resume not downloading?**
- Check file exists: `Test-Path "apps\portfolio-ui\public\resume\Leo_Klemet_Resume_2025.pdf"`
- Test direct URL: http://localhost:3000/resume/Leo_Klemet_Resume_2025.pdf
- Check nginx logs: `docker logs portfolio-nginx`

## Documentation

- Full details: `RESUME_LOGO_UPDATE.md`
- Resume README: `apps/portfolio-ui/public/resume/README.md`
- Helper script: `scripts/save-ledgermind-logo.ps1`

---

**Ready to proceed? Just save the logo PNG and run the commands above!** 🚀
