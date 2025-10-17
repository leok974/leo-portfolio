# Social Media URLs Updated

## Date
October 14, 2025

## Changes Made

Updated all social media URLs in the portfolio to match the correct profiles:

### URLs Updated

| Platform | Old URL | New URL |
|----------|---------|---------|
| **GitHub** | `https://github.com/leo-klemet` | `https://github.com/leok974` |
| **LinkedIn** | `https://www.linkedin.com/in/leo-klemet/` | `https://www.linkedin.com/in/leo-klemet-1241662a6/` |
| **ArtStation** | `https://www.artstation.com/leo_klemet` | `https://leoklemet3.artstation.com` |
| **Email** | `mailto:leoklemet.pa@gmail.com` | *(unchanged)* |

### Locations Updated

**File:** `apps/portfolio-ui/index.html`

1. **About Section Social Icons** (lines 108-116)
   - GitHub icon link
   - LinkedIn icon link
   - ArtStation icon link

2. **JSON-LD Structured Data** (lines 33-35)
   - Schema.org metadata for SEO
   - All three social profile URLs in `sameAs` array

### Verification

```bash
# Deployed and live at:
http://localhost:8090/

# Verified URLs in HTML:
✅ GitHub: https://github.com/leok974
✅ LinkedIn: https://www.linkedin.com/in/leo-klemet-1241662a6/
✅ ArtStation: https://leoklemet3.artstation.com
```

### Build & Deploy

```powershell
# Rebuilt portfolio
npm run build:portfolio

# Restarted container
docker compose -f docker-compose.portfolio-only.yml restart portfolio-ui
```

## Testing

Open http://localhost:8090/ and verify:
- [x] GitHub icon links to `https://github.com/leok974`
- [x] LinkedIn icon links to `https://www.linkedin.com/in/leo-klemet-1241662a6/`
- [x] ArtStation icon links to `https://leoklemet3.artstation.com`
- [x] All links open in new tab with `target="_blank"`
- [x] JSON-LD metadata contains correct URLs for SEO

## Notes

- All social links use `target="_blank" rel="noopener noreferrer"` for security
- URLs are consistent across both the visible icons and the structured data
- Email address remains unchanged: `leoklemet.pa@gmail.com`
