# Phase 50.5 — SEO Approve → PR & Before/After Preview

**Date:** 2025-10-08  
**Status:** Implementation Ready  
**Extends:** Phase 50.4 (SEO & OG Intelligence backend stubs)

---

## 🎯 Overview

Phase 50.5 adds two critical features to the SiteAgent SEO optimization workflow:

1. **Approve → PR Automation** - One-click creation of GitHub PRs with SEO changes
2. **Before/After Preview** - Side-by-side visual comparison of meta tags and OG images

### Key Features

- **Git Worktree Integration** - Clean patch application in isolated worktree
- **GitHub Token Auth** - Secure PR creation with GITHUB_TOKEN
- **Visual Preview Cards** - Compare title, description, and OG images
- **Event Emission** - Track PR creation in agent event log
- **Fallback Handling** - Graceful degradation when gh CLI unavailable

---

## 🏗️ Architecture

### Backend Flow

```
1. User clicks "Approve → PR" in tools.html
   ↓
2. Frontend: POST /agent/seo/act?action=seo.pr
   ↓
3. Backend: seo_pr.py validates GITHUB_TOKEN and diff
   ↓
4. Git worktree created from base branch
   ↓
5. Unified diff applied and committed
   ↓
6. Branch pushed with token authentication
   ↓
7. gh CLI creates PR (or returns branch info)
   ↓
8. Response: {ok: true, branch, pr}
```

### Frontend Flow

```
1. User runs "Dry Run" → generates diff
   ↓
2. Diff parsed into before/after data structure
   ↓
3. MetaCardPreview renders side-by-side cards
   ↓
4. User clicks "Approve → PR"
   ↓
5. Backend creates PR and returns info
   ↓
6. Toast notification confirms success
```

---

## 📁 Files to Create/Modify

### New Files (3)

1. **assistant_api/services/seo_pr.py** (134 lines)
   - PR builder with git worktree isolation
   - GitHub token authentication
   - Event emission for tracking
   - Error handling for config/file issues

2. **src/features/agent/SeoTunePanel.tsx** (NEW or UPGRADE)
   - Approve → PR button
   - Before/After preview cards
   - Diff parser for meta extraction
   - Toast notifications

3. **tests/e2e/seo-pr-preview.spec.ts** (22 lines)
   - Smoke test for PR flow
   - Preview card visibility validation

### Modified Files (1)

4. **assistant_api/routers/seo.py**
   - Add POST `/agent/seo/act?action=seo.pr` endpoint
   - Wire to `open_seo_pr()` service
   - Error handling for config/file issues

---

## 🔧 Backend Implementation

### 1. PR Builder Service

**File:** `assistant_api/services/seo_pr.py`

**Key Functions:**
- `open_seo_pr(base_branch, branch_prefix)` - Main PR creation flow
- `_run(cmd, cwd)` - Git command executor
- `SeoPRConfigError` - Custom exception for config issues

**Requirements:**
- `GITHUB_TOKEN` environment variable
- Git remote 'origin' pointing to GitHub (HTTPS)
- Existing `seo-tune.diff` artifact from Phase 50.4

**Process:**
1. Validate GITHUB_TOKEN and artifacts
2. Create timestamped branch name
3. Create git worktree from base branch
4. Apply unified diff as patch
5. Commit changes with SEO tune message
6. Push to origin with token auth
7. Create PR via gh CLI (if available)
8. Return branch and PR info

**Safety:**
- Uses temporary worktree (isolated from main repo)
- Cleans up worktree after push
- Falls back gracefully if gh CLI missing

### 2. Router Extension

**File:** `assistant_api/routers/seo.py`

**New Endpoint:**
```python
POST /agent/seo/act?action=seo.pr
```

**Behavior:**
- Validates action parameter
- Calls `open_seo_pr()` from seo_pr service
- Returns `{ok: true, branch, pr}` on success
- Returns HTTP 400 for config errors
- Returns HTTP 404 if diff not found

---

## 🎨 Frontend Implementation

### 1. SeoTunePanel Component

**Location:** `src/features/agent/SeoTunePanel.tsx` (new or upgrade existing)

**New State:**
```typescript
const [beforeAfter, setBeforeAfter] = useState<{
  before?: { title?: string; description?: string; og?: string }
  after?: { title?: string; description?: string; og?: string }
} | null>(null)
```

**New Functions:**

1. **parseBeforeAfterFromDiff(diff: string)**
   - Parses unified diff for meta changes
   - Extracts title, description, og_image
   - Returns `{before: {...}, after: {...}}`

2. **openPR()**
   - POST to `/agent/seo/act?action=seo.pr`
   - Displays toast on success/error
   - Keeps artifacts visible after PR creation

3. **MetaCardPreview({ data })**
   - Renders side-by-side before/after cards
   - Shows title, description, OG image
   - Handles missing OG images gracefully

**UI Structure:**
```tsx
<section id="seo-tune">
  <header>
    <button onClick={runDryRun}>Dry Run</button>
    <button onClick={loadArtifacts}>Refresh</button>
    <button onClick={openPR}>Approve → PR</button>
  </header>
  
  <div className="grid grid-cols-2">
    {/* Diff and Log sections */}
  </div>
  
  <div>
    <h3>Before / After (Meta & OG)</h3>
    <MetaCardPreview data={beforeAfter} />
  </div>
</section>
```

---

## 🧪 Testing

### E2E Test

**File:** `tests/e2e/seo-pr-preview.spec.ts`

**Coverage:**
1. Verify tools page loads with dev overlay
2. Run dry run to generate diff
3. Verify preview cards render
4. Click "Approve → PR" button
5. Confirm no error toasts
6. Verify diff remains visible after PR

**Skip Conditions:**
- Dev overlay not enabled
- GITHUB_TOKEN not set (optional - test can mock)

---

## 🔐 Security & Configuration

### Environment Variables

**Required:**
```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
```

**Optional:**
```bash
GIT_REMOTE=origin  # Default: origin
BASE_BRANCH=main   # Default: main
```

### Permissions

**GitHub Token Scope:**
- `repo` - Full repository access
- `workflow` - If PR triggers workflows

**Git Remote:**
- Must use HTTPS (not SSH)
- Format: `https://github.com/owner/repo.git`

### Safety Considerations

1. **Admin-Gated:** `/agent/seo/act` requires dev overlay cookie
2. **Token Isolation:** GITHUB_TOKEN never exposed to frontend
3. **Worktree Cleanup:** Temporary worktree always removed
4. **Validation:** Checks for GITHUB_TOKEN and diff before starting
5. **Fallback:** If gh CLI missing, returns branch info (manual PR)

---

## 📋 Usage Guide

### Step 1: Configure Backend

```bash
# Set GitHub token
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx

# Verify git remote
git remote -v
# origin  https://github.com/owner/repo.git (fetch)
```

### Step 2: Run SEO Tune

```bash
# Via API
curl -X POST "http://127.0.0.1:8001/agent/seo/tune?dry_run=true"

# Via tools.html
# 1. Enable dev overlay
# 2. Visit /tools.html
# 3. Click "Dry Run"
```

### Step 3: Review Preview

```
┌─────────────────────────────────────────────────┐
│ Before / After (Meta & OG)                      │
├──────────────────────┬──────────────────────────┤
│ Before               │ After                    │
├──────────────────────┼──────────────────────────┤
│ LedgerMind           │ LedgerMind — AI Port...  │
│ AI-powered finance..│ AI-powered finance agent │
│                      │ with explainable ML...   │
│ [OG Image Thumb]     │ [Generated OG Image]     │
└──────────────────────┴──────────────────────────┘
```

### Step 4: Approve → PR

```
Click "Approve → PR" button
↓
Backend creates PR
↓
Toast: "PR created: https://github.com/owner/repo/pull/123"
```

### Step 5: Review & Merge

1. Visit PR URL in GitHub
2. Review diff and reasoning log
3. Request reviews if needed
4. Merge when approved

---

## 🔄 Integration Points

### Phase 50.4 Dependencies

**Required Artifacts:**
- `agent/artifacts/seo-tune.diff` - Unified diff
- `agent/artifacts/seo-tune.md` - Reasoning log

**Required Endpoint:**
- `POST /agent/seo/tune?dry_run=true` - Generate artifacts

### Future Enhancements (Phase 50.6+)

1. **Auto-Merge:** Merge PR automatically after CI passes
2. **Rollback:** Revert PR if issues detected
3. **Batch PRs:** Group multiple SEO tunes into one PR
4. **Preview Deployment:** Deploy preview with Vercel/Netlify
5. **CTR Prediction:** Estimate CTR improvement before applying

---

## 🐛 Troubleshooting

### Error: "GITHUB_TOKEN not set"

**Solution:**
```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
# Or add to .env file for docker-compose
```

### Error: "seo-tune.diff not found"

**Solution:**
```bash
# Run dry run first
curl -X POST "http://127.0.0.1:8001/agent/seo/tune?dry_run=true"
```

### Error: "git push failed"

**Possible Causes:**
1. Token lacks repo permissions
2. Remote not set to HTTPS
3. Branch protection rules blocking push

**Solution:**
```bash
# Check remote URL
git remote get-url origin
# Should be: https://github.com/owner/repo.git

# Check token scopes in GitHub settings
```

### Error: "gh pr create failed"

**Solution:**
- Install gh CLI: `https://cli.github.com/`
- Or accept branch-only response (manual PR)

---

## 📊 Success Metrics

**Backend:**
- ✅ `seo_pr.py` service created
- ✅ `/agent/seo/act` endpoint working
- ✅ PR creation successful
- ✅ Event emission tracking PRs

**Frontend:**
- ✅ SeoTunePanel with Approve button
- ✅ Before/After preview cards rendering
- ✅ Diff parser extracting meta correctly
- ✅ Toast notifications working

**Testing:**
- ✅ E2E test passes
- ✅ PR visible in GitHub
- ✅ Diff applied correctly
- ✅ Reasoning log in PR body

---

## 📚 API Reference

### POST /agent/seo/act

**Query Parameters:**
- `action` (required) - Action to perform (`seo.pr`)

**Response (Success):**
```json
{
  "ok": true,
  "branch": "seo/tune-20251008-043000",
  "pr": "https://github.com/owner/repo/pull/123"
}
```

**Response (No gh CLI):**
```json
{
  "ok": true,
  "branch": "seo/tune-20251008-043000",
  "pr": null,
  "detail": "PR not created (gh missing); branch pushed"
}
```

**Error Responses:**
```json
// 400 - Config Error
{"detail": "GITHUB_TOKEN not set"}

// 404 - Artifact Missing
{"detail": "seo-tune.diff not found; run seo.tune first"}

// 400 - Unsupported Action
{"ok": false, "detail": "unsupported_action"}
```

---

## 🎯 Phase 50.5 Status

**Specification:** ✅ Complete  
**Implementation:** ⏳ Ready to begin  
**Testing:** ⏳ Pending  
**Documentation:** ✅ Complete  

**Next Steps:**
1. Create `assistant_api/services/seo_pr.py`
2. Update `assistant_api/routers/seo.py`
3. Create/upgrade `SeoTunePanel.tsx`
4. Add E2E test `seo-pr-preview.spec.ts`
5. Test PR flow end-to-end
6. Document in CHANGELOG.md

---

**Phase:** 50.5  
**Extends:** 50.4 (SEO backend stubs)  
**Prepares For:** 50.6 (Auto-merge & rollback)  
**Branch:** LINKEDIN-OPTIMIZED
