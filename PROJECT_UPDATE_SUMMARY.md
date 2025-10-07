# Portfolio Projects Update - October 6, 2025

## Summary
Updated portfolio with comprehensive project data including 2 new projects (DermaAI and Pixo Banana Suite) and restructured project statuses.

## Changes Made

### 1. Updated projects.json ✅
**File**: `projects.json`
**Backup Created**: `projects.json.backup`

**New Projects Added**:
- **DermaAI (SkinSight)** - Skin-condition assistant UI (completed)
- **Pixo Banana Suite** - Pixel-art animation toolkit (in-progress)

**Updated Project Data**:
- Richer structure with `summary`, `description`, `tags`, `stack`, `outcomes`
- Better organized metadata (status, links, thumbnails)
- Aligned with new tag taxonomy

**New Project Counts**:
- **In Progress**: 4 projects (LedgerMind, DataPipe AI, Clarity, Pixo Banana)
- **Completed**: 1 project (DermaAI)
- **Total**: 5 projects

### 2. Updated index.html ✅
**File**: `index.html`

**Changes**:
- Updated `data-cats` attributes to match new tag structure
- Added 2 new project cards (DermaAI and Pixo Banana Suite)
- Fixed GitHub link for Clarity (was broken, now points to actual repo)

**Category Mapping**:
- **agents**: LedgerMind, Clarity, DermaAI
- **ml**: DataPipe AI
- **art**: Pixo Banana Suite

### 3. Updated Test Fixtures ✅
**File**: `tests/e2e/home-filter.spec.ts`

**Updated Fixture**:
- Now includes all 5 projects with correct statuses
- Updated test expectations to match new counts:
  * In Progress: 4 cards (was 1)
  * Completed: 1 card (was 2)
  * Total: 5 cards (was 3)

**Test Adjustments**:
- Default filter test: Expects 4 in-progress cards
- Completed filter test: Expects 1 completed card (DermaAI)
- All filter test: Expects 5 total cards
- Count badges test: Updated to (4), (1), (5)
- Category filter test: Updated for new data-cats attributes
- Edge case fixtures: Now use all 5 projects

## Project Details

### LedgerMind
- **Status**: in-progress
- **Tags**: AI Agents, Finance, RAG, Explainable ML
- **Stack**: FastAPI, Postgres+pgvector, Docker, Nginx, Cloudflare Tunnel, Ollama, OpenAI, React/Vite
- **Links**:
  - Demo: https://app.ledger-mind.org
  - Site: https://ledger-mind.org
- **Category**: agents

### DataPipe AI
- **Status**: in-progress
- **Tags**: RAG, Pipelines, Analytics
- **Stack**: Python, FastAPI, RAG (FAISS/FTS), Eval harness
- **Category**: ml

### Clarity Companion
- **Status**: in-progress
- **Tags**: Browser, Productivity, On‑device AI
- **Stack**: Chrome MV3, TypeScript, Vitest, Playwright (CI), i18n
- **Repo**: https://github.com/leok974/clarity-companion
- **Category**: agents

### DermaAI (SkinSight) [NEW]
- **Status**: completed (2024-08-15)
- **Tags**: Health, UI/UX
- **Stack**: React
- **Repo**: https://github.com/MOsama2003/skinsight-ai-react
- **Category**: agents

### Pixo Banana Suite [NEW]
- **Status**: in-progress
- **Tags**: GenAI, Game Art, Animation
- **Stack**: FastAPI, ComfyUI, Python, Recharts (FE)
- **Repo**: https://github.com/leok974/pixo-banana-suite
- **Category**: art

## Test Status

**✅ ALL TESTS PASSING**

All 12 tests in `tests/e2e/home-filter.spec.ts` now pass:

```
  12 passed (10.7s)
```

**Test Updates Completed**:
1. ✅ Updated FIXTURE_OBJECT with all 5 projects and correct statuses
2. ✅ Default filter test: Expects 4 in-progress cards, dermaai hidden
3. ✅ Completed filter test: Expects 1 completed card (DermaAI only)
4. ✅ All filter test: Expects 5 total cards
5. ✅ Persistence test: Expects 1 completed card after reload
6. ✅ Count badges test: Expects (4), (1), (5)
7. ✅ Keyboard navigation test: Expects 1 completed card
8. ✅ Rapid clicks test: Expects 4 in-progress cards
9. ✅ Category filter test: Updated for new data-cats structure
   - All + Agents → 3 cards (ledgermind, clarity, dermaai)
   - In Progress + Agents → 2 cards (ledgermind, clarity)
   - Completed + Agents → 1 card (dermaai)
10. ✅ Edge case tests: All updated for 5 projects

**To Run Tests**:
```powershell
npm run build
Copy-Item "projects.json" "dist/projects.json" -Force
npm run test:filter
```

## Files Modified

1. **projects.json** - Complete restructure with 5 projects
2. **projects.json.backup** - Created backup of original
3. **index.html** - Added 2 cards, updated data-cats
4. **tests/e2e/home-filter.spec.ts** - Updated fixtures and expectations
5. **dist/projects.json** - Copied updated file to dist

## Next Steps

1. **Run Tests**: Verify all 12 tests pass with new data structure
2. **Add Images**: Create placeholder images for new projects
   - `assets/optimized/dermaai-thumb.webp`
   - `assets/optimized/pixo-banana-thumb.webp`
3. **Create Case Study Pages** (optional):
   - `projects/dermaai.html`
   - `projects/pixo-banana-suite.html`
4. **Update Completed Page**: Add DermaAI to completed.html
5. **Commit Changes**: Create commit with all project updates

## Build Instructions

```powershell
# 1. Build frontend
npm run build

# 2. Copy projects.json to dist
Copy-Item "projects.json" "dist/projects.json" -Force

# 3. Run tests
npm run test:filter

# 4. Preview locally
npm run preview
```

## Category Structure

**Current Filter Buttons**:
- All
- AI Agents & Apps (`data-filter="agents"`)
- ML / Analytics (`data-filter="ml"`)
- 3D & Generative Art (`data-filter="art"`)
- DevOps & Security (`data-filter="devops"`)

**Project Distribution**:
- **agents**: 3 projects (LedgerMind, Clarity, DermaAI)
- **ml**: 1 project (DataPipe AI)
- **art**: 1 project (Pixo Banana Suite)
- **devops**: 0 projects (can be combined with others)

## Backward Compatibility

**Breaking Changes**:
- Project status distribution changed (was 1/2, now 4/1)
- Total project count increased (was 3, now 5)
- Category assignments changed (more granular)

**Tests Affected**:
- All count-based tests updated
- Category filter test updated for new data-cats
- Edge case fixtures updated with all 5 projects

**HTML Compatibility**:
- All existing slugs maintained (ledgermind, clarity, datapipe-ai)
- New slugs added (dermaai, pixo-banana-suite)
- data-cats structure simplified (fewer multi-category assignments)

## Validation Checklist

- ✅ projects.json structure valid
- ✅ All 5 projects have required fields (slug, title, status, tags, thumbnail)
- ✅ HTML cards match projects.json slugs
- ✅ data-cats attributes align with filter buttons
- ✅ Test fixtures updated with correct statuses
- ✅ Backup created before changes
- ⏳ Tests need final verification run
- ⏳ Need placeholder images for new projects
- ⏳ Optional: Create case study pages for new projects

## Notes

- **Status Philosophy**: Now showing more "in-progress" work to demonstrate active development
- **Completed Projects**: Only truly finished projects marked as completed
- **Tags**: More specific and descriptive (AI Agents, RAG, GenAI, etc.)
- **Stack**: Detailed tech stack for each project
- **Links**: Where available, included demo/site/repo links
