# Hermetic Test Suite - Complete Changes

## Summary

Added comprehensive hermetic test runner scripts that automatically set up the entire test environment, including shared infrastructure, database migrations, model verification, and Playwright tests.

---

## New Files

### 1. `scripts/test-all.ps1` (NEW)

**Purpose:** Windows PowerShell hermetic test runner

**Features:**
- Auto-detects backend and web directories (`assistant_api`, `src`)
- Starts shared infra from `D:\infra` if available
- Brings up E2E Postgres if `docker-compose.e2e.yml` exists
- Runs `ensure-models.ps1` to verify Ollama models
- Executes backend migrations and database reset
- Seeds dev user for E2E tests
- Runs web typecheck and lint
- Installs Playwright browsers with system deps
- Executes full Playwright suite with proper env vars

**Parameters:**
- `-Baseline`: Pass `--update-snapshots` to Playwright
- `-Grep <pattern>`: Filter tests by title pattern

**Usage:**
```powershell
$env:DOCKER_CONTEXT="desktop-linux"
pwsh .\scripts\test-all.ps1
pwsh .\scripts\test-all.ps1 -Baseline
pwsh .\scripts\test-all.ps1 -Grep "dev unlock"
```

---

### 2. `scripts/test-all.sh` (NEW)

**Purpose:** macOS/Linux bash hermetic test runner

**Features:**
- Same functionality as PowerShell version
- Auto-detects directories with `find_dir` helper
- Checks multiple infra locations (`/mnt/d/infra`, `../../infra`, `../infra`)
- Handles both `ensure-models.sh` and `ensure-models.ps1`
- Uses inline Python heredoc for seed script fallback

**Usage:**
```bash
chmod +x scripts/test-all.sh
./scripts/test-all.sh
BASELINE=1 ./scripts/test-all.sh
./scripts/test-all.sh "@a11y"
```

---

## Modified Files

### 3. `README.md` (UPDATED)

**Added Section:** "Run All Tests (Hermetic)"

**Location:** Before "Playwright Test Modes (Dev vs Strict)" section (line ~252)

**Content:**
- Complete hermetic test suite overview
- Windows PowerShell examples with parameters
- macOS/Linux bash examples
- Detailed explanation of what the script does (6 steps)
- Auto-configured environment variables list
- Clear separation with horizontal rules

**Diff:**

```diff
@@ -250,6 +250,51 @@
 For production / day-2 operational procedures (status headers, legacy cutover, integrity drift, CI health workflow), see `OPERATIONS.md` (root) and the extended guide in `docs/OPERATIONS.md`.

+---
+
+## Run All Tests (Hermetic)
+
+**Complete end-to-end test suite** that automatically:
+- Starts shared infrastructure (D:\infra with Ollama, PostgreSQL, Cloudflare Tunnel)
+- Ensures required models are loaded
+- Runs backend migrations/reset/seed
+- Executes web typecheck + lint
+- Runs full Playwright test suite
+
+### Windows (PowerShell)
+
+```powershell
+$env:DOCKER_CONTEXT="desktop-linux"
+pwsh .\scripts\test-all.ps1
+
+# Update snapshots only:
+pwsh .\scripts\test-all.ps1 -Baseline
+
+# Filter Playwright by title:
+pwsh .\scripts\test-all.ps1 -Grep "tooltip visual baseline"
+```
+
+### macOS/Linux
+
+```bash
+./scripts/test-all.sh
+
+# With baseline update:
+BASELINE=1 ./scripts/test-all.sh
+
+# Filtered:
+./scripts/test-all.sh "@a11y"
+```
+
+**What it does:**
+1. Uses project E2E Postgres (`docker-compose.e2e.yml`) if present, or shared infra (`INFRA_DIR`) if available
+2. Runs `scripts/ensure-models.ps1` to verify Ollama models
+3. Executes backend migrations, resets E2E database, seeds dev user
+4. Runs web typecheck and lint
+5. Installs Playwright browsers with system dependencies
+6. Executes full Playwright test suite with proper environment variables
+
+---
+
 ### Playwright Test Modes (Dev vs Strict)
```

---

## Key Improvements

### 1. **Zero Manual Setup**
- No need to manually start Docker containers
- No need to manually install models
- No need to manually migrate database
- No need to manually configure environment variables

### 2. **Cross-Platform**
- Windows: PowerShell with proper parameters
- macOS/Linux: Bash with environment variables
- Auto-detects directories and infra locations

### 3. **Flexible Infrastructure**
- Works with shared infra (`D:\infra`)
- Works with project-scoped E2E compose
- Falls back gracefully if components missing

### 4. **Developer Experience**
- Color-coded console output
- Progress indicators for long operations
- Clear error messages with context
- Supports filtered test runs and snapshot updates

### 5. **CI/CD Ready**
- Exit codes properly propagated
- Strict mode enabled (`Set-StrictMode`, `set -euo pipefail`)
- Environment variable isolation
- Hermetic execution (repeatable results)

---

## Testing the Changes

### Windows

```powershell
# Full test suite
$env:DOCKER_CONTEXT="desktop-linux"
pwsh .\scripts\test-all.ps1

# Update visual baselines
pwsh .\scripts\test-all.ps1 -Baseline

# Run specific test pattern
pwsh .\scripts\test-all.ps1 -Grep "dev unlock"
```

### macOS/Linux

```bash
# Make executable (first time only)
chmod +x scripts/test-all.sh

# Full test suite
./scripts/test-all.sh

# Update visual baselines
BASELINE=1 ./scripts/test-all.sh

# Run specific test pattern
./scripts/test-all.sh "@a11y"
```

---

## Dependencies

**Required:**
- Docker (with desktop-linux context)
- Node.js + pnpm
- Python (if backend present)

**Optional but recommended:**
- Shared infra at `D:\infra` (or `INFRA_DIR` env var)
- `docker-compose.e2e.yml` for project-scoped E2E database
- `scripts/ensure-models.ps1` for model verification

---

## Architecture

```
test-all.ps1 / test-all.sh
  │
  ├─ 1. Detect directories (backend, web)
  ├─ 2. Start D:\infra (ollama, pg, cloudflared)
  ├─ 3. Start E2E Postgres (if docker-compose.e2e.yml)
  ├─ 4. Ensure models (scripts/ensure-models.ps1)
  ├─ 5. Backend setup
  │    ├─ Install requirements.txt
  │    ├─ Run migrations (alembic upgrade head)
  │    ├─ Reset E2E database
  │    └─ Seed dev user
  ├─ 6. Web setup
  │    ├─ pnpm install
  │    ├─ pnpm run typecheck
  │    └─ pnpm run lint
  └─ 7. Playwright
       ├─ Install browsers + deps
       ├─ Set environment variables
       └─ Run tests (with filters/baseline as needed)
```

---

## Files Changed

✅ **scripts/test-all.ps1** (NEW) - Windows PowerShell runner
✅ **scripts/test-all.sh** (NEW) - macOS/Linux bash runner
✅ **README.md** (UPDATED) - Added "Run All Tests (Hermetic)" section

**No files removed** - All existing scripts preserved.
