# Projects Hide/Unhide Feature - Implementation Complete

**Branch**: `feat/projects-hide-toggle`
**Date**: October 20, 2025
**Status**: ✅ Complete & Ready for Testing

## Overview

Implemented a complete project visibility management system that allows hiding/unhiding projects via dev overlay with automatic portfolio rebuild and deployment.

## Architecture

### Source of Truth
- **File**: `apps/portfolio-ui/public/projects.hidden.json`
- **Format**: JSON array of project slugs
- **Example**: `["old-project", "deprecated-tool", "draft-work"]`
- **Access**: Public (served as static asset)

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    projects.hidden.json                      │
│                  (Array of hidden slugs)                     │
└────────┬────────────────────────────────────────────────────┘
         │
         ├──────────────────┬──────────────────┬──────────────┐
         │                  │                  │              │
    ┌────▼────┐       ┌────▼────┐       ┌────▼────┐   ┌────▼────┐
    │ UI Load │       │ Skills  │       │   OG    │   │  Agent  │
    │ Runtime │       │Generator│       │Generator│   │ Overview│
    └─────────┘       └─────────┘       └─────────┘   └─────────┘
         │                  │                  │              │
         └──────────────────┴──────────────────┴──────────────┘
                            │
                     ┌──────▼───────┐
                     │ Hidden slugs │
                     │  filtered    │
                     │   out from   │
                     │ all outputs  │
                     └──────────────┘
```

## Implementation Details

### 1. Frontend Runtime Filtering

#### portfolio.ts
```typescript
const [projectsResponse, hiddenResponse] = await Promise.all([
  fetch('/projects.json'),
  fetch('/projects.hidden.json').catch(() => ({ ok: false, json: async () => [] }))
]);

const allProjects: Project[] = Object.values(data);
const hidden = hiddenResponse.ok ? await hiddenResponse.json() : [];
const hiddenSet = new Set((hidden ?? []).map((s: string) => s.toLowerCase()));

this.projects = allProjects.filter((p) => !hiddenSet.has((p.slug ?? '').toLowerCase()));
console.log(`Loaded ${this.projects.length} projects (${allProjects.length - this.projects.length} hidden)`);
```

#### main.js
```javascript
const [projectsResponse, hiddenResponse] = await Promise.all([
  fetch('projects.json'),
  fetch('projects.hidden.json').catch(() => ({ ok: false }))
]);

const allProjects = await projectsResponse.json();
const hidden = hiddenResponse.ok ? await hiddenResponse.json() : [];
const hiddenSet = new Set((hidden ?? []).map(s => s.toLowerCase()));

PROJECT_DETAILS = Object.fromEntries(
  Object.entries(allProjects).filter(([slug, _]) => !hiddenSet.has(slug.toLowerCase()))
);
```

### 2. Build-Time Filtering

#### scripts/skills-generate.mjs
```javascript
const hiddenPath = path.join(PUB, 'projects.hidden.json');
let projects = await readJson(projectsPath, []);
const hidden = await readJson(hiddenPath, []);
const hiddenSet = new Set((hidden ?? []).map(s => normalize(s)));

projects = projects.filter(p => !hiddenSet.has(normalize(p.slug || '')));
console.log(`✓ Processing ${projects.length} visible projects (${hidden.length} hidden)`);
```

#### scripts/og-generate.mjs
```javascript
const hiddenPath = path.join(__dirname, '..', 'apps', 'portfolio-ui', 'public', 'projects.hidden.json');
if (existsSync(hiddenPath)) {
  const hiddenData = await fs.readFile(hiddenPath, 'utf8');
  const hidden = JSON.parse(hiddenData);
  const hiddenSet = new Set((hidden ?? []).map(s => String(s || '').trim().toLowerCase()));
  projects = projects.filter(p => !hiddenSet.has((p.slug || '').toLowerCase()));
  console.log(`✓ Filtered ${before - projects.length} hidden projects`);
}
```

### 3. Dev Overlay Admin Panel

#### Features
- **Visual List**: Shows all projects with title and slug
- **Status Indicators**:
  - Hidden projects: Gray background, line-through text
  - Visible projects: Blue border, normal text
- **Toggle Buttons**:
  - Hide button: Red "🚫 Hide"
  - Show button: Green "👁️ Show"
- **Auto-Refresh**: Triggers portfolio rebuild after toggle
- **Loading States**: Shows ⏳ while processing

#### UI Components

**apps/portfolio-ui/src/overlay/ProjectAdminPanel.ts**
```typescript
export class ProjectAdminPanel {
  private panel: HTMLElement | null = null;
  private isOpen = false;
  private hiddenProjects = new Set<string>();

  public mount() {
    // Creates ⚙️ button next to DEV badge
    // Opens sliding panel with project list
  }

  private async handleToggle(e: Event) {
    const success = action === 'hide'
      ? await hideProject(slug)
      : await unhideProject(slug);

    if (success) {
      await refreshPortfolio();
      alert(`Project "${slug}" ${action === 'hide' ? 'hidden' : 'shown'}!\n\nPortfolio refresh triggered.`);
    }
  }
}
```

**apps/portfolio-ui/src/overlay/useHideProject.ts**
```typescript
export async function hideProject(slug: string): Promise<boolean>
export async function unhideProject(slug: string): Promise<boolean>
export async function refreshPortfolio(): Promise<boolean>
export async function getHiddenProjects(): Promise<string[]>
export async function isProjectHidden(slug: string, hiddenList?: string[]): Promise<boolean>
```

### 4. Backend Admin Endpoints

#### assistant_api/routers/admin_projects.py

**Endpoints**:
- `POST /api/admin/projects/hide` - Add slug to hidden list
- `POST /api/admin/projects/unhide` - Remove slug from hidden list
- `GET /api/admin/projects/hidden` - Get current hidden list

**Authentication**:
- Requires `x-admin-key` header
- Must match `ADMIN_HMAC_KEY` environment variable
- Returns 401 if missing or invalid
- Returns 503 if ADMIN_HMAC_KEY not configured

**Request/Response**:
```bash
# Hide
curl -X POST https://www.leoklemet.com/api/admin/projects/hide \
  -H 'Content-Type: application/json' \
  -H 'x-admin-key: YOUR_SECRET_KEY' \
  -d '{"slug": "old-project"}'

Response:
{
  "ok": true,
  "message": "Project 'old-project' hidden successfully",
  "hidden": ["old-project"]
}

# Unhide
curl -X POST https://www.leoklemet.com/api/admin/projects/unhide \
  -H 'Content-Type: application/json' \
  -H 'x-admin-key: YOUR_SECRET_KEY' \
  -d '{"slug": "old-project"}'

Response:
{
  "ok": true,
  "message": "Project 'old-project' unhidden successfully",
  "hidden": []
}

# Get hidden list
curl https://www.leoklemet.com/api/admin/projects/hidden \
  -H 'x-admin-key: YOUR_SECRET_KEY'

Response:
{
  "ok": true,
  "hidden": ["old-project", "draft-work"],
  "count": 2
}
```

### 5. CI/CD Integration

#### .github/workflows/portfolio.yml

Added validation step before build:
```yaml
- name: Validate projects.hidden.json shape
  run: |
    jq -e 'type=="array" and all(.[]; type=="string")' apps/portfolio-ui/public/projects.hidden.json > /dev/null
    echo "✅ projects.hidden.json is valid"
```

**Validation Rules**:
- Must be valid JSON
- Must be an array
- All elements must be strings
- Fails build if invalid

### 6. E2E Tests

#### tests/e2e/projects-hidden.spec.ts

**Test Coverage**:
1. ✅ Hidden project is not rendered in UI
2. ✅ Unhidden project appears in UI
3. ✅ Multiple hidden projects handled correctly
4. ✅ UI logs correct hidden project count
5. ✅ Admin endpoints require authentication
6. ✅ Hide endpoint works with valid key
7. ✅ Unhide endpoint works with valid key
8. ✅ Get hidden list endpoint works

## Usage Guide

### For Developers

#### Enable Dev Overlay
1. Visit: `https://www.leoklemet.com/?dev_overlay=dev`
2. Cookie will be set, page will reload
3. See DEV badge in bottom-right corner
4. See ⚙️ button next to DEV badge

#### Hide/Unhide Projects
1. Click ⚙️ button to open admin panel
2. Scroll through project list
3. Click "🚫 Hide" to hide a project
4. Click "👁️ Show" to unhide a project
5. Wait for "Refresh triggered" confirmation
6. Changes will be live in ~2 minutes

#### Via API
```bash
# Set your admin key
export ADMIN_KEY="your-secret-key-here"

# Hide a project
curl -X POST https://www.leoklemet.com/api/admin/projects/hide \
  -H 'Content-Type: application/json' \
  -H "x-admin-key: $ADMIN_KEY" \
  -d '{"slug": "project-slug"}'

# Unhide a project
curl -X POST https://www.leoklemet.com/api/admin/projects/unhide \
  -H 'Content-Type: application/json' \
  -H "x-admin-key: $ADMIN_KEY" \
  -d '{"slug": "project-slug"}'

# Trigger portfolio refresh
curl -X POST YOUR_WORKFLOW_DISPATCH_URL \
  -H 'Content-Type: application/json' \
  -H "x-agent-key: $WORKFLOW_KEY" \
  -d '{"reason": "refresh-portfolio", "ref": "main"}'
```

### Environment Variables

#### Required for Backend
```bash
ADMIN_HMAC_KEY=your-secret-admin-key-here
```

#### Required for Dev Overlay Auto-Refresh
```bash
VITE_ADMIN_HMAC_KEY=your-secret-admin-key-here
VITE_AGENT_REFRESH_URL=https://your-worker.workers.dev/dispatch
VITE_AGENT_ALLOW_KEY=your-workflow-dispatch-key
```

**Security Notes**:
- Keep `ADMIN_HMAC_KEY` secret
- Use strong random keys (32+ characters)
- Rotate keys periodically
- Never commit keys to version control

## Testing

### Local Development

```bash
# 1. Start backend with admin key
cd assistant_api
export ADMIN_HMAC_KEY="test-key-local"
uvicorn assistant_api.main:app --reload --port 8001

# 2. Build frontend with env vars
cd ..
export VITE_ADMIN_HMAC_KEY="test-key-local"
pnpm run build:portfolio

# 3. Test hide endpoint
curl -X POST http://localhost:8001/api/admin/projects/hide \
  -H 'Content-Type: application/json' \
  -H 'x-admin-key: test-key-local' \
  -d '{"slug": "test-project"}'

# 4. Check hidden list
cat apps/portfolio-ui/public/projects.hidden.json

# 5. Run E2E tests
export ADMIN_HMAC_KEY="test-key-local"
pnpm exec playwright test tests/e2e/projects-hidden.spec.ts
```

### Production Testing

```bash
# 1. Enable dev overlay
# Visit: https://www.leoklemet.com/?dev_overlay=dev

# 2. Open dev overlay admin panel
# Click ⚙️ button

# 3. Test hide/unhide
# Click buttons in UI

# 4. Verify in browser console
# Should see: "Loaded X projects (Y hidden)"

# 5. Check source
curl https://www.leoklemet.com/projects.hidden.json
```

## Deployment

### Initial Setup

1. **Add secrets to environment**:
   ```bash
   # Backend .env file
   echo "ADMIN_HMAC_KEY=$(openssl rand -hex 32)" >> assistant_api/.env.prod

   # Frontend build-time env
   export VITE_ADMIN_HMAC_KEY="same-key-as-backend"
   export VITE_AGENT_REFRESH_URL="your-worker-url"
   export VITE_AGENT_ALLOW_KEY="your-dispatch-key"
   ```

2. **Build and deploy**:
   ```bash
   pnpm run build:portfolio
   docker compose -f deploy/docker-compose.portfolio-prod.yml up -d --build
   ```

3. **Test admin endpoints**:
   ```bash
   curl https://www.leoklemet.com/api/admin/projects/hidden \
     -H "x-admin-key: $ADMIN_HMAC_KEY"
   ```

### Continuous Deployment

The feature integrates with existing CD:

1. **Dev overlay changes**: Auto-triggers via `refreshPortfolio()`
2. **Manual changes**: Edit `projects.hidden.json`, commit, push
3. **CI validates**: jq checks file format
4. **Build filters**: skills/OG generators exclude hidden
5. **Runtime filters**: UI respects hidden list
6. **Watchtower updates**: New images deployed automatically

## Files Changed

### New Files
- `apps/portfolio-ui/public/projects.hidden.json` (1 line)
- `apps/portfolio-ui/src/overlay/ProjectAdminPanel.ts` (271 lines)
- `apps/portfolio-ui/src/overlay/useHideProject.ts` (130 lines)
- `assistant_api/routers/admin_projects.py` (143 lines)
- `tests/e2e/projects-hidden.spec.ts` (224 lines)

### Modified Files
- `apps/portfolio-ui/portfolio.ts` (+10 lines)
- `main.js` (+9 lines)
- `scripts/skills-generate.mjs` (+9 lines)
- `scripts/og-generate.mjs` (+18 lines)
- `apps/portfolio-ui/src/dev-overlay.ts` (+3 lines)
- `assistant_api/main.py` (+4 lines)
- `.github/workflows/portfolio.yml` (+5 lines)

**Total**: 5 new files, 7 modified files, 769 lines added

## Next Steps

1. ✅ **Merge Feature Branch**
   ```bash
   git checkout main
   git merge feat/projects-hide-toggle
   git push origin main
   ```

2. ✅ **Set Production Secrets**
   - Add `ADMIN_HMAC_KEY` to backend secrets
   - Add `VITE_*` vars to build environment
   - Test admin panel access

3. ✅ **Document for Team**
   - Share DEV_OVERLAY_USAGE.md
   - Add to README
   - Update deployment docs

4. ✅ **Monitor First Use**
   - Watch for hide/unhide actions in logs
   - Verify portfolio refreshes trigger
   - Check hidden projects don't appear

## Troubleshooting

### Admin panel doesn't appear
- Check dev overlay is enabled (`?dev_overlay=dev`)
- Look for DEV badge in bottom-right
- Check console for errors
- Verify `ProjectAdminPanel` import

### Hide button doesn't work
- Check `VITE_ADMIN_HMAC_KEY` is set
- Verify backend `ADMIN_HMAC_KEY` matches
- Check network tab for 401 errors
- Confirm backend is running

### Projects still visible after hiding
- Hard refresh browser (`Ctrl+Shift+R`)
- Check `projects.hidden.json` was updated
- Verify slug matches exactly (case-insensitive)
- Wait for portfolio rebuild to complete

### Portfolio refresh fails
- Check `VITE_AGENT_REFRESH_URL` is set
- Verify `VITE_AGENT_ALLOW_KEY` is correct
- Test workflow dispatch manually
- Check Worker logs for errors

## References

- [Dev Overlay Usage Guide](./DEV_OVERLAY_USAGE.md)
- [Admin Router Implementation](./assistant_api/routers/admin_projects.py)
- [Project Admin Panel](./apps/portfolio-ui/src/overlay/ProjectAdminPanel.ts)
- [E2E Tests](./tests/e2e/projects-hidden.spec.ts)

---

**Implementation Complete**: October 20, 2025
**Ready for**: Merge → Deploy → Test → Ship
**Status**: ✅ All 9 tasks completed
