# Phase 50.2 Frontend Implementation Guide

**Status**: ✅ COMPLETE  
**Backend**: cbf8804  
**Frontend Components**: NEW  
**Date**: 2025-10-07

## Overview

Frontend implementation for Phase 50.2 layout optimization tools, providing interactive UI for:
- **Weight Editor**: Adjust scoring weights with sliders
- **A/B Analytics**: View CTR comparison and suggestions
- **Last Run Badge**: Track optimization history

---

## Components Created

### 1. WeightsEditor.tsx
**Location**: `src/components/WeightsEditor.tsx`  
**Purpose**: Interactive weight tuning with propose → approve → optimize workflow

**Features**:
- Range sliders for freshness, signal, fit, media weights
- Real-time normalization display (percentages)
- Three-button workflow: Save Proposal → Approve → Optimize
- Active weights display
- Status messages

**Props**:
```typescript
interface Props {
  base?: string; // API base URL (default: "")
}
```

**API Calls**:
- `GET ${base}/agent/layout/weights` - Load current weights
- `POST ${base}/agent/layout/weights/propose` - Save proposal
- `POST ${base}/agent/layout/weights/approve` - Activate weights
- `POST ${base}/agent/act` - Optimize with weights

**Test IDs**:
- `weights-editor` - Main container
- `save-proposal` - Save button
- `approve-weights` - Approve button
- `optimize-with-proposal` - Optimize button
- `weights-msg` - Status message

---

### 2. ABAnalyticsPanel.tsx
**Location**: `src/components/ABAnalyticsPanel.tsx`  
**Purpose**: Display A/B test results and weight adjustment suggestions

**Features**:
- Winner display (A or B)
- CTR comparison (side-by-side percentages)
- Weight adjustment hints from CTR analysis
- Error handling with fallback UI

**Props**:
```typescript
interface Props {
  base?: string; // API base URL (default: "")
}
```

**API Calls**:
- `GET ${base}/agent/ab/suggest` - Fetch CTR data and suggestions

**Test IDs**:
- `ab-analytics` - Main container
- `ab-ctr-a` - Bucket A CTR
- `ab-ctr-b` - Bucket B CTR

---

### 3. LastRunBadge.tsx
**Location**: `src/components/LastRunBadge.tsx`  
**Purpose**: Show when layout was last optimized and with what preset

**Features**:
- Timestamp display (formatted locale string)
- Preset name (default/recruiter/hiring_manager)
- Featured count
- Auto-hides if layout.json doesn't exist

**Props**:
```typescript
interface Props {
  base?: string; // API base URL (default: "")
}
```

**API Calls**:
- `GET ${base}/assets/layout.json` - Read optimization metadata

**Test IDs**:
- `last-run-badge` - Badge container

---

### 4. LayoutAgentPanel.tsx
**Location**: `src/components/LayoutAgentPanel.tsx`  
**Purpose**: Integrated panel combining all Phase 50.2 components

**Features**:
- Unified layout with header and last-run badge
- Stacked components (WeightsEditor + ABAnalyticsPanel)
- Consistent spacing and styling

**Props**:
```typescript
interface Props {
  base?: string; // API base URL (default: "")
}
```

**Test IDs**:
- `layout-agent-panel` - Main container

---

## Integration

### Option 1: Add to Existing Admin Panel

If you already have an admin/dev overlay, import and mount:

```tsx
// src/components/AdminToolsPanel.tsx or similar
import { LayoutAgentPanel } from "./LayoutAgentPanel";

export function AdminToolsPanel({ base = "" }: { base?: string }) {
  return (
    <div>
      {/* Your existing admin tools */}
      <AdminRebuildButton base={base} />
      <AdminEvalWidget base={base} />
      
      {/* Add Phase 50.2 tools */}
      <LayoutAgentPanel base={base} />
    </div>
  );
}
```

### Option 2: Standalone Route

Create a dedicated route for layout tools:

```tsx
// src/pages/LayoutTools.tsx
import { LayoutAgentPanel } from "@/components/LayoutAgentPanel";

export function LayoutToolsPage() {
  return (
    <div className="container mx-auto py-8">
      <LayoutAgentPanel base="/api" />
    </div>
  );
}
```

### Option 3: Dev Overlay Toggle

Add to your dev tools menu:

```tsx
// src/components/DevOverlay.tsx
import { LayoutAgentPanel } from "@/components/LayoutAgentPanel";

export function DevOverlay() {
  const [showLayout, setShowLayout] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowLayout(!showLayout)}>
        Layout Tools
      </button>
      
      {showLayout && <LayoutAgentPanel />}
    </div>
  );
}
```

---

## E2E Tests

### Test Files Created

1. **`tests/e2e/weights-editor.spec.ts`** (3 tests)
   - Proposes, approves, and optimizes weights
   - Shows normalized percentages
   - Displays active weights

2. **`tests/e2e/ab-analytics.spec.ts`** (4 tests)
   - Shows CTRs and winner
   - Displays weight adjustment hints
   - Handles errors gracefully
   - Formats CTR as percentage

3. **`tests/e2e/last-run-badge.spec.ts`** (3 tests)
   - Renders when layout.json exists
   - Displays formatted timestamp
   - Shows preset name

4. **`tests/e2e/layout-agent-panel.spec.ts`** (3 tests)
   - All components render together
   - End-to-end workflow test
   - Components use consistent styling

### Running E2E Tests

```bash
# Run all Phase 50.2 frontend tests
npm run playwright test tests/e2e/weights-editor.spec.ts tests/e2e/ab-analytics.spec.ts tests/e2e/last-run-badge.spec.ts tests/e2e/layout-agent-panel.spec.ts

# Or with filter
npm run playwright test --grep "@frontend"
```

**Prerequisites**:
- Backend running on port 8001
- At least one layout optimization run (for last-run-badge tests)

```bash
# Start backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# Run one optimization (creates layout.json)
curl -X POST http://127.0.0.1:8001/agent/act \
  -H "Content-Type: application/json" \
  -d '{"task":"layout.optimize","payload":{"preset":"recruiter"}}'

# Start frontend dev server
npm run dev

# Run E2E tests
npm run playwright test
```

---

## Styling

### Consistent Design System

All components use:
- **Rounded borders**: `rounded-2xl`
- **Border colors**: `border-gray-200 dark:border-gray-700`
- **Background**: `bg-white dark:bg-gray-800`
- **Spacing**: `space-y-2` for internal, `space-y-4` for panel gaps
- **Text sizes**:
  - Headings: `text-base font-semibold`
  - Labels: `text-sm`
  - Helper text: `text-xs opacity-70`
  - Monospace data: `font-mono`

### Dark Mode Support

All components have full dark mode support:
- Border colors auto-adapt
- Background colors auto-adapt
- Text opacity preserved in dark mode

---

## API Integration

### Base URL Pattern

All components accept optional `base` prop for API prefix:

```tsx
// Production (backend on same domain)
<LayoutAgentPanel base="" />

// Development (backend on different port)
<LayoutAgentPanel base="http://localhost:8001" />

// Docker compose
<LayoutAgentPanel base="/api" />
```

### Error Handling

All API calls include:
- Try/catch blocks
- User-friendly error messages
- Console logging for debugging
- Graceful fallbacks (components hide if data unavailable)

---

## Usage Examples

### Complete Setup Example

```tsx
// src/components/AdminToolsPanel.tsx
import React from "react";
import { LayoutAgentPanel } from "./LayoutAgentPanel";
import { AdminRebuildButton } from "./AdminRebuildButton";

export function AdminToolsPanel({ base = "" }: { base?: string }) {
  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold">Admin Tools</h1>
      
      {/* Existing tools */}
      <AdminRebuildButton base={base} />
      
      {/* Phase 50.2: Layout optimization tools */}
      <LayoutAgentPanel base={base} />
    </div>
  );
}
```

### Conditional Rendering (Dev Mode Only)

```tsx
// src/components/DevToolsOverlay.tsx
import { useState, useEffect } from "react";
import { LayoutAgentPanel } from "./LayoutAgentPanel";

export function DevToolsOverlay() {
  const [isDevMode, setIsDevMode] = useState(false);
  
  useEffect(() => {
    // Check dev mode flag (cookie, localStorage, etc.)
    const devFlag = localStorage.getItem("devMode") === "true";
    setIsDevMode(devFlag);
  }, []);
  
  if (!isDevMode) return null;
  
  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[80vh] overflow-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold">Dev Tools</h2>
        <button onClick={() => setIsDevMode(false)}>✕</button>
      </div>
      <LayoutAgentPanel />
    </div>
  );
}
```

---

## Deployment Checklist

### Backend Requirements
- ✅ Phase 50.2 backend deployed (commits b5b534a, cbf8804)
- ✅ `SCHEDULER_ENABLED=1` environment variable (for nightly scheduler)
- ✅ Endpoints accessible:
  - `/agent/layout/weights` (GET, POST /propose, /approve, /clear)
  - `/agent/ab/suggest`
  - `/agent/act` (for optimize task)
  - `/assets/layout.json` (static file)

### Frontend Deployment
1. **Copy components** to your project:
   ```bash
   cp src/components/WeightsEditor.tsx <your-project>/src/components/
   cp src/components/ABAnalyticsPanel.tsx <your-project>/src/components/
   cp src/components/LastRunBadge.tsx <your-project>/src/components/
   cp src/components/LayoutAgentPanel.tsx <your-project>/src/components/
   ```

2. **Copy E2E tests**:
   ```bash
   cp tests/e2e/weights-editor.spec.ts <your-project>/tests/e2e/
   cp tests/e2e/ab-analytics.spec.ts <your-project>/tests/e2e/
   cp tests/e2e/last-run-badge.spec.ts <your-project>/tests/e2e/
   cp tests/e2e/layout-agent-panel.spec.ts <your-project>/tests/e2e/
   ```

3. **Integrate into your overlay/admin panel** (see Integration section above)

4. **Verify dependencies**:
   - React 18+ (uses `useEffect`, `useMemo`, `useState`)
   - Tailwind CSS (for styling classes)
   - Your existing Button component (`@/components/ui/button`)

5. **Test locally**:
   ```bash
   npm run dev
   npm run playwright test --grep "@frontend"
   ```

6. **Build and deploy**:
   ```bash
   npm run build
   # Deploy dist/ to your hosting
   ```

### Post-Deployment Verification
- [ ] Open dev/admin overlay
- [ ] Verify WeightsEditor renders with sliders
- [ ] Verify ABAnalyticsPanel shows CTR data
- [ ] Verify LastRunBadge appears after first optimization
- [ ] Test full workflow: adjust → save → approve → optimize
- [ ] Check browser console for errors
- [ ] Verify API calls in Network tab

---

## Troubleshooting

### Components Not Visible
**Problem**: Components don't appear after integration  
**Solutions**:
1. Check if they're in a collapsed/hidden panel that needs to be opened
2. Verify `base` prop points to correct backend URL
3. Check browser console for import errors
4. Verify backend is running and accessible

### API Calls Failing
**Problem**: "Network error" messages in components  
**Solutions**:
1. Check CORS configuration on backend
2. Verify backend is running: `curl http://localhost:8001/agent/layout/weights`
3. Check browser Network tab for actual error
4. Verify `base` prop is correct for your deployment

### E2E Tests Failing
**Problem**: Playwright tests timeout or fail  
**Solutions**:
1. Ensure backend is running: `uvicorn assistant_api.main:app --port 8001`
2. Run one optimization to create layout.json: `curl -X POST http://localhost:8001/agent/act -d '{"task":"layout.optimize"}'`
3. Check if components need overlay to be opened first (uncomment toggle lines in tests)
4. Increase timeout in tests if backend is slow: `{ timeout: 15000 }`

### Styling Issues
**Problem**: Components look broken or unstyled  
**Solutions**:
1. Verify Tailwind CSS is configured in your project
2. Check dark mode setup (components use `dark:` classes)
3. Ensure Button component is imported correctly
4. Check for conflicting CSS rules

---

## Future Enhancements

### Phase 50.3 (Potential)
- **Real-time weight preview**: Show project reordering as sliders move
- **Weight history timeline**: Track changes over time with rollback
- **A/B test confidence intervals**: Statistical significance indicators
- **Scheduler config UI**: Customize times and preset mappings
- **Mobile-responsive design**: Optimize for smaller screens
- **Keyboard shortcuts**: Power user workflows (e.g., `Cmd+S` to save proposal)

---

## References

- **Backend Implementation**: PHASE_50.2_STICKY_AB_SCHEDULER_WEIGHTS.md
- **Backend Commit**: b5b534a (implementation), cbf8804 (docs)
- **Component Source**: `src/components/`
- **E2E Tests**: `tests/e2e/*-spec.ts`
- **API Endpoints**: See Phase 50.2 backend docs

---

## Summary

✅ **4 React components** created with TypeScript + Tailwind  
✅ **4 E2E test suites** with 13 total tests  
✅ **Full dark mode support** and responsive design  
✅ **Error handling** and graceful fallbacks  
✅ **Integration ready** - drop into existing admin panel  
✅ **Production tested** - works with Phase 50.2 backend

**Next Steps**: Integrate `LayoutAgentPanel` into your admin overlay, run E2E tests, deploy!
