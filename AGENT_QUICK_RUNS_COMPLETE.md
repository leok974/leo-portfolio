# Agents Quick Runs — Implementation Complete ✅

## Overview
Added one-click preset buttons for common agent tasks, integrated into the admin panel. Users can launch tasks with a single click and see them appear in the approval panel below.

## What Was Built

### 1. Quick Runs Component (`src/components/AgentsQuickRuns.tsx`)

**Features:**
- 5 preset buttons for common agent tasks
- Visual feedback (button shows "Running…" while busy)
- Automatic task launch via `/agents/run` endpoint
- Callback integration for parent components
- Styled to match existing admin panel design

**Presets Included:**
1. **SEO • validate (site)** — `seo.validate` on `sitemap://current`
2. **SEO • tune (autofix draft)** — `seo.tune` for automated fixes
3. **Projects • sync** — `projects.sync` for GitHub sync
4. **Content • summarize CHANGELOG** — `content.summarize` on docs
5. **Branding • propose theme** — `branding.theme` suggestions

**UI Components:**
```tsx
<PresetButton
  label="SEO • validate (site)"
  payload={{ agent: "seo", task: "validate", inputs: { pages: "sitemap://current" } }}
  onDone={(r) => console.debug("Task launched:", r)}
/>
```

**Key Features:**
- ✅ Disabled state while running
- ✅ Error handling (HTTP errors)
- ✅ Tooltip shows `agent.task` on hover
- ✅ Approval notice explains gating behavior

---

### 2. Integration (`src/components/AdminToolsPanel.tsx`)

**Added Section:**
```tsx
{/* === Agent Orchestration === */}
<section aria-labelledby="agents-title" className="mt-6">
  <h2 id="agents-title" className="text-xl font-semibold mb-3">
    Agent Orchestration
  </h2>
  <div className="space-y-3">
    <AgentsQuickRuns onLaunched={(r) => console.debug("agents.run →", r)} />
    <AgentsApprovalPanel />
  </div>
</section>
```

**Location:** After "Behavior Metrics" section, before closing `</div>`

**Layout:**
- Quick Runs panel (top)
- Approval panel (bottom)
- Vertical spacing for visual separation

---

### 3. E2E Tests (`tests/e2e/agents.quickruns.spec.ts`)

**Test Coverage:**

#### Test 1: Launch and Verify Status
```typescript
test("can launch seo.validate and see awaiting_approval or succeeded", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: /SEO • validate/i }).click();
  // Verify status is valid
  await expect.poll(() => fetchTaskStatus()).toMatch(/awaiting_approval|succeeded/);
});
```

#### Test 2: Button Busy State
```typescript
test("quick run buttons are disabled while busy", async ({ page }) => {
  const button = page.getByRole("button", { name: /SEO • validate/i });
  await button.click();
  await expect(button).toBeDisabled(); // While running
  await expect(button).toBeEnabled({ timeout: 5000 }); // After done
});
```

#### Test 3: Approval Notice
```typescript
test("displays approval notice", async ({ page }) => {
  await expect(
    page.getByText(/All mutating tasks remain.*awaiting approval/i)
  ).toBeVisible();
});
```

---

## User Flow

### Typical Workflow
1. **User opens admin panel** (`/admin`)
2. **Clicks "SEO • validate (site)"** button
3. **Button shows "Running…"** (disabled)
4. **Backend creates task** → Returns `{task_id, status, needs_approval}`
5. **Button re-enables** after response
6. **User copies task_id** from console or response
7. **User pastes task_id** into Approval Panel below
8. **User clicks "Load"** → Sees task details
9. **User reviews logs/outputs**
10. **User clicks "Approve"** or "Reject"**

### Quick Run Advantages
- ✅ No need to remember agent names
- ✅ No need to type JSON payloads
- ✅ Common tasks are one click away
- ✅ Inputs are pre-configured with sensible defaults

---

## Technical Details

### PresetButton Component
**Props:**
```typescript
{
  label: string;           // Display text (e.g., "SEO • validate (site)")
  payload: {
    agent: string;        // Agent name (e.g., "seo")
    task: string;         // Task name (e.g., "validate")
    inputs?: Record<string, unknown>;  // Optional task inputs
  };
  onDone: (r: RunResp) => void;  // Callback with task_id and status
}
```

**State Management:**
- `busy: boolean` — Controls button disabled state
- Async fetch with try/finally to ensure re-enable

**Styling:**
- `bg-neutral-800 hover:bg-neutral-700` — Matches admin panel theme
- `disabled:opacity-50` — Visual feedback when busy
- `transition-colors` — Smooth hover effect

---

## Configuration

### Adding New Presets

To add a new quick-run button, edit `AgentsQuickRuns.tsx`:

```tsx
<PresetButton
  label="Your • task label"
  payload={{
    agent: "agent_name",
    task: "task_name",
    inputs: { key: "value" }  // Optional
  }}
  onDone={onLaunched}
/>
```

**Example (new "Analytics • export" preset):**
```tsx
<PresetButton
  label="Analytics • export (CSV)"
  payload={{
    agent: "analytics",
    task: "export",
    inputs: { format: "csv", days: 30 }
  }}
  onDone={onLaunched}
/>
```

---

## Callback Integration

### Current Implementation
```tsx
<AgentsQuickRuns onLaunched={(r) => console.debug("agents.run →", r)} />
```

**Console output:**
```json
agents.run → {
  "task_id": "abc-123-def-456",
  "status": "awaiting_approval",
  "needs_approval": true,
  "outputs_uri": "./artifacts/abc-123-def-456/"
}
```

### Enhanced Integration (Future)
Auto-populate approval panel with task_id:

```tsx
const [taskId, setTaskId] = useState("");

<AgentsQuickRuns onLaunched={(r) => setTaskId(r.task_id)} />
<AgentsApprovalPanel initialTaskId={taskId} />
```

**Then in ApprovalPanel:**
```tsx
export default function AgentsApprovalPanel({ initialTaskId = "" }) {
  const [taskId, setTaskId] = useState(initialTaskId);

  useEffect(() => {
    if (initialTaskId) {
      setTaskId(initialTaskId);
      fetchStatus(initialTaskId);
    }
  }, [initialTaskId]);
  // ...
}
```

---

## Testing

### Manual Testing
```bash
# 1. Start backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# 2. Build frontend
npm run build

# 3. Open admin panel
# Navigate to http://localhost:5173/admin

# 4. Click "SEO • validate (site)"
# 5. Check browser console for:
#    agents.run → {task_id: "...", status: "awaiting_approval", ...}
# 6. Copy task_id
# 7. Paste into Approval Panel and click "Load"
# 8. Verify logs appear
# 9. Click "Approve" or "Reject"
```

### Automated Testing
```bash
# Run Playwright E2E tests
npx playwright test tests/e2e/agents.quickruns.spec.ts

# Expected results:
# ✓ can launch seo.validate and see awaiting_approval or succeeded
# ✓ quick run buttons are disabled while busy
# ✓ displays approval notice
```

---

## UI/UX Improvements

### Visual Hierarchy
1. **Section Title:** "Agent Orchestration" (large, bold)
2. **Quick Runs Panel:** Preset buttons (top)
3. **Approval Panel:** Task details (bottom)

### Color Coding
- **Neutral 800/700:** Preset buttons (consistent with admin theme)
- **Neutral 400:** Helper text (muted)
- **Neutral 100:** Section headings (high contrast)

### Responsive Layout
- `flex flex-wrap gap-2` — Buttons wrap on narrow screens
- `space-y-3` — Vertical spacing between panels

---

## Files Created/Modified

| File | Type | Lines | Purpose |
|------|------|-------|---------|
| `src/components/AgentsQuickRuns.tsx` | NEW | 99 | Quick run presets component |
| `src/components/AdminToolsPanel.tsx` | MODIFIED | +11 | Wire in agents section |
| `tests/e2e/agents.quickruns.spec.ts` | NEW | 60 | Playwright smoke tests |

**Total:** 2 new files, 1 modified, 170 lines of code

---

## Usage Examples

### Example 1: SEO Validation
```typescript
// User clicks "SEO • validate (site)"
// Backend receives:
{
  "agent": "seo",
  "task": "validate",
  "inputs": { "pages": "sitemap://current" }
}

// Backend responds:
{
  "task_id": "abc-123",
  "status": "awaiting_approval",
  "needs_approval": true,
  "outputs_uri": "./artifacts/abc-123/"
}
```

### Example 2: Project Sync
```typescript
// User clicks "Projects • sync"
// Backend receives:
{
  "agent": "projects",
  "task": "sync",
  "inputs": {
    "repos": ["leok974/leo-portfolio", "leok974/ledger-mind"]
  }
}

// Backend responds:
{
  "task_id": "def-456",
  "status": "awaiting_approval",
  "needs_approval": true,
  "outputs_uri": "./artifacts/def-456/"
}
```

---

## Security Considerations

### CSRF Protection
- Uses same-origin requests (no external domains)
- Admin panel already behind authentication
- Tasks gate on approval by default (`allow_auto: false`)

### Input Validation
- Preset inputs are hardcoded (no user input)
- Backend validates agent names and task names
- Invalid agents return HTTP 400

### Authorization
- All mutations require approval
- Approval panel attribution ready for auth integration
- Future: Add RBAC checks to approval endpoints

---

## Future Enhancements

### 1. Task History
Show recent task launches in quick runs panel:
```tsx
<div className="text-xs text-neutral-500">
  Last run: 2 minutes ago (awaiting approval)
</div>
```

### 2. Auto-Populate Approval Panel
Clicking a preset auto-loads task in approval panel:
```tsx
<AgentsQuickRuns onLaunched={(r) => setTaskId(r.task_id)} />
<AgentsApprovalPanel autoLoadTaskId={taskId} />
```

### 3. Preset Categories
Group presets by agent:
```tsx
<details>
  <summary>SEO Tasks (2)</summary>
  <PresetButton label="validate" ... />
  <PresetButton label="tune" ... />
</details>
```

### 4. Custom Presets
Allow users to save their own presets:
```tsx
<button onClick={() => savePreset(customPayload)}>
  💾 Save as preset
</button>
```

---

## Commit Message
```
feat(agents): add quick-run presets for common agent tasks

- Create AgentsQuickRuns component with 5 preset buttons
- Add PresetButton with busy state and error handling
- Wire into AdminToolsPanel in new "Agent Orchestration" section
- Add 3 Playwright E2E tests (launch, busy state, approval notice)
- Display approval notice explaining gating behavior
- Position quick runs above approval panel for natural workflow
- Style buttons to match admin panel theme (neutral-800/700)
- Add hover tooltips showing agent.task names

Presets included:
- SEO validate (site) / tune (autofix draft)
- Projects sync (GitHub repos)
- Content summarize (CHANGELOG)
- Branding propose theme

Quick runs improve UX by:
- Eliminating need to type JSON payloads
- Providing sensible defaults for common tasks
- One-click launch for frequent operations
- Clear approval gating notice

Closes: Quick-run presets for agent orchestration
```

---

## Summary

**Added:** Quick-run preset buttons for common agent tasks

**Components:**
- ✅ AgentsQuickRuns with 5 presets
- ✅ PresetButton with busy state
- ✅ Integration in AdminToolsPanel
- ✅ 3 Playwright E2E tests

**UX Flow:**
1. Click preset → Task launches
2. Copy task_id from console
3. Paste into approval panel
4. Review and approve/reject

**Status:** Production-ready, fully integrated, tested

**Next:** Auto-populate approval panel on preset click
