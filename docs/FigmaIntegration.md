# Figma + MCP Integration (Phase 51)

> **Status:** Phase 51.0 MVP scaffold complete
> **Goal:** Bring Figma design intelligence into SiteAgent for brand asset generation and design system automation.

---

## Overview

This integration connects your portfolio to Figma via the Model Context Protocol (MCP), enabling:

- **Business Card Generator** (MVP) - Automated card generation from site metadata
- **Design Tokens Bridge** - Sync colors, typography, and spacing to Tailwind/CSS
- **Asset Suite** - Resume, social banners, email signatures, OG images
- **Design System Compliance** - Audit files for token usage and component consistency

---

## Architecture

```
┌─────────────────┐
│  Dev Overlay    │
│  (Brand Tab)    │
└────────┬────────┘
         │
         │ POST /agent/brand/card
         ↓
┌─────────────────────────────────────┐
│  FastAPI Backend                    │
│  assistant_api/routers/brand.py     │
└──────────────┬──────────────────────┘
               │
               │ MCP Tools
               ↓
┌─────────────────────────────────────┐
│  Figma MCP Service                  │
│  assistant_api/services/mcp/        │
│  figma_tools.py                     │
└──────────────┬──────────────────────┘
               │
               │ REST API
               ↓
┌─────────────────────────────────────┐
│  Figma Platform                     │
│  - Template duplication             │
│  - Node export (PNG, PDF, SVG)      │
│  - Component search                 │
│  - Style extraction                 │
└─────────────────────────────────────┘
```

---

## Setup

### 1. Generate Figma Personal Access Token

1. Go to [Figma Account Settings](https://www.figma.com/settings)
2. Scroll to **Personal Access Tokens**
3. Click **Generate new token**
4. Name: `leo-portfolio-mcp`
5. Scopes required:
   - `File content` (read)
   - `File export` (read/write for exports)
6. Copy the token immediately (shown once)

### 2. Configure Environment Variables

Add to `.env.local` (backend):

```bash
# Figma MCP Integration
FIGMA_PAT=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FIGMA_TEAM_ID=123456789012345678  # Your team ID (from Figma URL)
FIGMA_TEMPLATE_KEY=AbCdEfGhIjKlMnOp  # Business card template file key
```

**Security notes:**
- Never commit `FIGMA_PAT` to git
- Store in secrets manager for production (e.g., GitHub Secrets, AWS Secrets Manager)
- Token has full access to all files in your Figma account - treat like a password
- Rotate tokens every 90 days

### 3. Create Business Card Template

1. Create a new Figma file: **SiteAgent Brand Card**
2. Create two frames:
   - `CardFront` (3.5" × 2" or 1050px × 600px at 300 DPI)
   - `CardBack` (same dimensions)
3. Add text layers with variable placeholders:
   - `{name}` - Full name
   - `{role}` - Job title
   - `{email}` - Contact email
   - `{domain}` - Website domain
   - `{qr_code}` - QR code image (optional)
4. Copy the file key from the URL:
   ```
   https://www.figma.com/file/AbCdEfGhIjKlMnOp/SiteAgent-Brand-Card
                            ^^^^^^^^^^^^^^^^
                            This is FIGMA_TEMPLATE_KEY
   ```
5. Set `FIGMA_TEMPLATE_KEY` in `.env.local`

---

## Usage

### Business Card Generator (MVP)

**Via Dev Overlay:**

1. Navigate to your portfolio: `http://localhost:5173/?dev_overlay=dev`
2. Click the **⚙️** button (bottom right)
3. Switch to the **Brand** tab
4. Click **Generate Business Card**
5. Wait for preview (duplicates template, injects metadata, exports PNG/PDF)
6. Click **Download PNG** or **Open in Figma**

**Via API:**

```bash
curl -X POST http://localhost:8001/api/agent/brand/card \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -d '{
    "name": "Leo Klemet",
    "role": "Full Stack Developer",
    "email": "leo@leoklemet.com",
    "domain": "leoklemet.com",
    "qr_url": "https://leoklemet.com"
  }'
```

**Response:**
```json
{
  "ok": true,
  "file_key": "XyZ123AbC456",
  "export": {
    "png": ["/agent/artifacts/cards/card-1234567890.png"],
    "pdf": ["/agent/artifacts/cards/card-1234567890.pdf"]
  }
}
```

### Design Tokens Sync (Phase 51.2)

```bash
npm run tokens:sync
```

This will:
1. Fetch color/text styles from Figma design system
2. Transform to W3C Design Tokens format
3. Update `tailwind.config.ts` with new color palette
4. Generate CSS custom properties in `apps/portfolio-ui/src/styles/tokens.css`

**Manual trigger via API:**

```bash
curl http://localhost:8001/api/agent/brand/tokens
```

---

## API Reference

### POST `/api/agent/brand/card`

Generate a business card from template.

**Auth:** Requires CF Access token or `x-admin-key` header

**Request:**
```typescript
{
  name: string;        // Full name
  role: string;        // Job title
  email: string;       // Contact email
  domain: string;      // Website domain
  qr_url?: string;     // QR code URL (defaults to domain)
}
```

**Response:**
```typescript
{
  ok: true;
  file_key: string;              // Figma file key (for "Open in Figma")
  export: {
    png: string[];               // PNG artifact paths
    pdf: string[];               // PDF artifact paths
  };
}
```

**Artifacts saved to:**
- `agent/artifacts/cards/card-{timestamp}.png`
- `agent/artifacts/cards/card-{timestamp}.pdf`
- `agent/artifacts/cards/card-{timestamp}_meta.json`

---

### GET `/api/agent/brand/templates`

List available brand asset templates.

**Response:**
```typescript
{
  ok: true;
  templates: Array<{
    id: string;          // "business_card", "resume", "social_banner"
    name: string;        // Display name
    type: string;        // "card", "resume", "banner"
    file_key: string;    // Figma template file key
    preview_url?: string;
  }>;
}
```

---

### GET `/api/agent/brand/tokens`

Get design tokens from Figma design system.

**Response:**
```typescript
{
  ok: true;
  tokens: {
    colors: Record<string, string>;      // Hex colors
    typography: Record<string, object>;  // Font families, sizes, weights
    spacing: Record<string, string>;     // Spacing scale
  };
}
```

---

### GET `/api/agent/brand/audit/{file_key}`

Audit Figma file for design system compliance.

**Response:**
```typescript
{
  ok: true;
  file_key: string;
  audit: {
    components: number;           // Total component instances
    untyped_text: number;         // Text without text styles
    non_token_colors: number;     // Fills without variable bindings
  };
}
```

---

## Rate Limits

Figma API rate limits (as of 2024):

- **Authenticated requests:** 1,000 per hour per token
- **Image exports:** 200 per hour per token
- **File reads:** 100 per hour per file

**Best practices:**
- Cache JWKS responses (5-minute TTL already implemented)
- Batch export requests when possible
- Use webhooks for real-time updates (Phase 51.4)

**Handling rate limits:**
- MCP service returns `HTTPStatusError` with `429 Too Many Requests`
- Frontend shows: "Figma API rate limit reached. Try again in 1 hour."
- Logs include `Retry-After` header value

---

## Troubleshooting

### "FIGMA_PAT environment variable not set"

**Cause:** Missing or invalid Figma PAT in environment.

**Fix:**
```bash
# Check .env.local
cat .env.local | grep FIGMA_PAT

# If missing, add:
echo "FIGMA_PAT=figd_your_token_here" >> .env.local

# Restart backend
```

---

### "Invalid file key"

**Cause:** `FIGMA_TEMPLATE_KEY` doesn't match a real Figma file.

**Fix:**
1. Open your template in Figma
2. Copy file key from URL (16-character alphanumeric)
3. Update `.env.local`:
   ```bash
   FIGMA_TEMPLATE_KEY=AbCdEfGhIjKlMnOp
   ```
4. Restart backend

---

### "403 Forbidden" on export

**Cause:** PAT lacks export permissions or file not accessible.

**Fix:**
1. Regenerate token with `File export` scope
2. Ensure file is in team visible to token
3. Check file sharing settings (must be accessible to token owner)

---

### Export images are blank

**Cause:** Nodes `CardFront` and `CardBack` don't exist or are hidden.

**Fix:**
1. Open template file
2. Ensure frames are named exactly `CardFront` and `CardBack` (case-sensitive)
3. Ensure frames are visible (not hidden layers)
4. Try manual export in Figma to verify rendering

---

### Rate limit errors

**Cause:** Exceeded 200 exports/hour or 1,000 requests/hour.

**Fix:**
- Wait for rate limit reset (check `Retry-After` header in logs)
- Reduce generation frequency
- Implement export caching (Phase 51.3)
- Consider upgrading to Figma Enterprise (higher limits)

---

## Security Considerations

### Token Storage

**Development:**
- Store in `.env.local` (gitignored)
- Never commit to repository

**Production:**
- Use secrets manager (AWS Secrets Manager, GitHub Secrets, etc.)
- Mount as read-only volume in Docker: `secrets/figma_pat:/run/secrets/figma_pat:ro`
- Load via environment variable in entrypoint

### Access Control

- All `/agent/brand/*` endpoints require CF Access authentication
- Dev bypass (`x-dev-key`) only works if `DEV_HMAC_KEY` configured
- Never log full PAT in application logs (mask: `figd_xxx...xxx`)

### CORS

- Brand endpoints follow same CORS policy as admin routes
- Only `ALLOWED_ORIGINS` can call from browser
- Consider separate subdomain for brand assets (e.g., `brand.leoklemet.com`)

---

## Future Roadmap

### Phase 51.1 - MCP Figma Core
- Implement `search_components()` for library browsing
- Add `get_styles()` for color/text style extraction
- Add `audit_file()` for design system compliance checks

### Phase 51.2 - Tokens Bridge
- Full token export (colors, typography, spacing, shadows)
- Automated Tailwind theme update
- CSS custom properties generation
- Git commit automation

### Phase 51.3 - Asset Suite
- Resume generator (PDF from Figma template)
- Social media banners (Twitter, LinkedIn, Facebook)
- Email signature generator
- Open Graph image generator (dynamic per-project)

### Phase 51.4 - Figma Plugin Bridge
- Bidirectional sync (push tokens from code to Figma)
- Component usage tracking
- A/B test variant generation
- Real-time preview updates

### Phase 51.5 - Analytics Loop
- CTR tracking per card variant
- Design quality metrics
- Automated A/B testing
- Design approval workflow

---

## References

- [Figma REST API Docs](https://www.figma.com/developers/api)
- [W3C Design Tokens Spec](https://design-tokens.github.io/community-group/format/)
- [Figma Webhooks](https://www.figma.com/developers/api#webhooks)
- [Figma Plugin API](https://www.figma.com/plugin-docs/intro/)

---

## Testing

**Unit tests:** `assistant_api/tests/test_brand_card.py`

Run tests:
```bash
pytest assistant_api/tests/test_brand_card.py -v
```

**E2E tests:** TODO - Add Playwright test for Brand tab

Test plan:
1. Open Dev Overlay
2. Navigate to Brand tab
3. Click "Generate Business Card"
4. Verify loading state
5. Verify preview image appears
6. Verify "Download PNG" link works
7. Verify "Open in Figma" link (if file_key present)

---

## Support

For issues or questions:
- Backend: Check `assistant_api/routers/brand.py` and `assistant_api/services/mcp/figma_tools.py`
- Frontend: Check `apps/portfolio-ui/src/overlay/ProjectAdminPanel.ts`
- Figma API: Check [Figma Community Forum](https://forum.figma.com/)
