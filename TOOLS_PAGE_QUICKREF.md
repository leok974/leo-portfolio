# Tools Page & AB Tracking - Quick Reference

## URLs

- **Tools Page:** `/tools.html` (admin/dev only)
- **Public Site:** `/` (with AB tracking)

## Dev Overlay API

```bash
# Enable
POST /agent/dev/enable

# Check
GET /agent/dev/status

# Disable
POST /agent/dev/disable
```

## Frontend Guards

```typescript
import { isPrivilegedUIEnabled, enableDevOverlay } from "@/lib/devGuard";

// Check access
const canAccess = await isPrivilegedUIEnabled();

// Enable overlay
await enableDevOverlay();
```

## AB Tracking

**Initialize (automatic in main.ts):**
```typescript
await getBucket();           // Assign bucket
await fireAbEvent("view");   // Log view
```

**Track Clicks:**
```typescript
await fireAbEvent("click");  // Log click + show toast
```

**Storage:**
- `localStorage.visitor_id` - UUID
- `localStorage.ab_bucket` - "A" or "B"

## E2E Tests

**Tools Page (requires dev overlay):**
```typescript
test.beforeEach(async ({ request }) => {
  await request.post("/agent/dev/enable");
});
await page.goto("/tools.html");
```

**Public Site (no auth needed):**
```typescript
await page.goto("/");
await page.locator('.card-click').first().click();
```

## Build

```bash
pnpm run build
# Outputs: index.html, tools.html, assets/*
```

## Run Tests

```bash
# All
pnpm playwright test tests/e2e/ab-*.spec.ts

# Tools only
pnpm playwright test tests/e2e/ab-winner-bold.spec.ts

# Public only
pnpm playwright test tests/e2e/ab-toast.spec.ts
```

## Files Created

- `assistant_api/routers/dev_overlay.py`
- `tools.html`
- `src/tools-entry.tsx`
- `src/lib/devGuard.ts`

## Files Modified

- `assistant_api/main.py` (mounted router)
- `src/components/AgentToolsPanel.tsx` (tools panel)
- `vite.config.ts` (multi-page)
- `src/main.ts` (AB tracking init)
- `tests/e2e/*.spec.ts` (test updates)
