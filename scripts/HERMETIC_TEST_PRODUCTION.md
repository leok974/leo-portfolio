# Hermetic Test Suite - Production Features

## Overview

Complete production-grade enhancements for the hermetic test suite including diagnostics collection, npm wrappers, CI/CD integration, and zero-config local testing.

---

## 1. Post-Mortem Bundle (Diagnostics Collection)

### Script: `scripts/collect-diag.ps1`

Automatically collects diagnostic information for debugging test failures.

**What it collects:**
- Container logs (last 400 lines each)
- Docker process listing
- Health endpoints (`/ready`, `/api/status/summary`, `/api/metrics`)
- Playwright test results and reports
- Environment information (versions, context, variables)

**Usage:**

```powershell
# Collect diagnostics with default settings
pwsh ./scripts/collect-diag.ps1

# Custom output directory
pwsh ./scripts/collect-diag.ps1 -OutDir ./my-diagnostics

# Custom container list
pwsh ./scripts/collect-diag.ps1 -Containers @('portfolio-nginx-1','portfolio-backend-1')
```

**Output structure:**

```
artifacts/diag-20251005-143022/
├── portfolio-nginx-1.log
├── portfolio-backend-1.log
├── infra-ollama-1.log
├── docker-ps.txt
├── 127.0.0.1_8080_ready.txt
├── 127.0.0.1_8080_api_metrics.txt
├── environment.txt
├── test-results/
├── playwright-report/
└── errors.txt
```

---

## 2. CI/CD Integration

### Automatic Diagnostics on Failure

Updated workflows automatically collect diagnostics when tests fail:

**`.github/workflows/e2e-ui-polish.yml`:**
```yaml
- name: Collect diagnostics (on failure)
  if: failure()
  shell: pwsh
  run: pwsh ./scripts/collect-diag.ps1

- name: Upload diagnostics
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: diag-bundle
    path: artifacts/**
    retention-days: 7
```

**New workflow: `.github/workflows/e2e-hermetic.yml`**

Split fast/full test lanes:
- **fast-frontend**: CSS/UX tests without backend (~5 min)
- **full-stack**: Complete integration tests (~25 min)

Both lanes include automatic diagnostic collection on failure.

---

## 3. Friendly npm Wrappers

### Added to `package.json`:

```json
{
  "scripts": {
    "test:all": "pwsh ./scripts/test-all.ps1",
    "test:all:frontend": "pwsh ./scripts/test-all.ps1 -FrontendOnly -Grep \"@ui-polish|@ui-polish-adv|@analytics-beacons\"",
    "test:all:skip-infra": "pwsh ./scripts/test-all.ps1 -SkipInfra",
    "test:all:baseline": "pwsh ./scripts/test-all.ps1 -Baseline",
    "diag:collect": "pwsh ./scripts/collect-diag.ps1"
  }
}
```

### Usage Examples:

```bash
# Full hermetic test suite
npm run test:all

# Frontend-only (fastest, CSS/UX/analytics)
npm run test:all:frontend

# Skip infrastructure startup (assumes services running)
npm run test:all:skip-infra

# Update Playwright snapshots
npm run test:all:baseline

# Collect diagnostics manually
npm run diag:collect

# Custom grep filter (pass through --)
npm run test:grep -- "@backend"
```

**Cross-platform note:** These wrappers use PowerShell for consistency. On macOS/Linux, use the bash script directly:

```bash
./scripts/test-all.sh --frontend-only "@ui-polish"
```

---

## 4. Zero-Config Local Runs (.env.test)

### Overview

Keep personal test configuration overrides without affecting CI or other developers.

### Setup

1. Copy example file:
   ```bash
   cp .env.test.example .env.test
   ```

2. Edit `.env.test` with your overrides:
   ```bash
   # .env.test
   BASE_URL=http://localhost:8080
   PLAYWRIGHT_GLOBAL_SETUP_SKIP=1
   BACKEND_REQUIRED=0
   OLLAMA_HOST=http://192.168.1.100:11434
   DEV_E2E_EMAIL=my.email@example.com
   DEV_E2E_PASSWORD=my-password
   ```

3. Add to `.gitignore` (already done):
   ```
   .env.test
   ```

### Automatic Loading

Both `test-all.ps1` and `test-all.sh` automatically load `.env.test` if present:

**PowerShell:**
```powershell
# Load .env.test if present (zero-config local runs)
$envTestFile = Join-Path $RepoRoot ".env.test"
if (Test-Path $envTestFile) {
  Write-Host "Loading .env.test..." -ForegroundColor Gray
  Get-Content $envTestFile | Where-Object { $_ -match '^\s*[^#]\w+=' } | ForEach-Object {
    $k,$v = $_ -split '=',2
    [System.Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim())
  }
}
```

**Bash:**
```bash
# Load .env.test if present
if [[ -f "$REPO_ROOT/.env.test" ]]; then
  echo "Loading .env.test..."
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
    export "$key=$value"
  done < "$REPO_ROOT/.env.test"
fi
```

### Common Use Cases

**Skip global setup when server already running:**
```bash
# .env.test
PLAYWRIGHT_GLOBAL_SETUP_SKIP=1
BASE_URL=http://localhost:8080
```

**Use remote Ollama instance:**
```bash
# .env.test
OLLAMA_HOST=http://192.168.1.100:11434
```

**Increase timeouts for slow machines:**
```bash
# .env.test
WAIT_PRIMARY_MS=180000
WAIT_SSE_MS=120000
```

**Custom test credentials:**
```bash
# .env.test
DEV_E2E_EMAIL=custom.email@example.com
DEV_E2E_PASSWORD=custom-password
DEV_SUPERUSER_PIN=654321
```

---

## 5. Split Fast vs Full CI Workflow

### New Workflow: `e2e-hermetic.yml`

Demonstrates best practices for CI/CD test organization.

### Two-Lane Strategy

#### Lane 1: fast-frontend (~5 minutes)
- **Purpose**: Rapid feedback on CSS/UX/analytics changes
- **Runs on**: Every PR, every push
- **Tests**: `@ui-polish`, `@analytics-beacons`
- **Backend**: Not required (uses Vite dev server)
- **Environment**:
  ```yaml
  PLAYWRIGHT_GLOBAL_SETUP_SKIP: "1"
  BASE_URL: "http://127.0.0.1:5173"
  ```

#### Lane 2: full-stack (~25 minutes)
- **Purpose**: Complete integration testing
- **Runs on**: After fast-frontend passes
- **Tests**: Full Playwright suite
- **Backend**: Required (Docker Compose with test override)
- **Services**: nginx, backend, Postgres, Ollama
- **Diagnostics**: Automatic collection on failure

### Workflow Benefits

1. **Fast feedback**: Frontend devs get results in 5 minutes
2. **Parallel work**: Backend tests don't block frontend iterations
3. **Resource efficiency**: Only run full stack when necessary
4. **Cost savings**: Shorter runs = lower CI costs
5. **Better debugging**: Automatic diagnostics on failure

### Using the Workflow

**Trigger conditions:**
- Pull requests (paths filter)
- Push to main
- Manual dispatch (`workflow_dispatch`)

**Viewing results:**
- Check Actions tab in GitHub
- Download artifacts on failure:
  - `diag-frontend` - Frontend test diagnostics
  - `diag-fullstack` - Full stack diagnostics
  - `test-results-frontend` - Playwright reports
  - `test-results-fullstack` - Playwright reports

---

## Complete Testing Workflow

### Local Development

```bash
# 1. Quick frontend checks (fastest)
npm run test:all:frontend

# 2. Skip infra if already running
npm run test:all:skip-infra

# 3. Full hermetic run
npm run test:all

# 4. Collect diagnostics if something fails
npm run diag:collect
```

### CI/CD Pipeline

```
Pull Request
  ↓
fast-frontend (5 min)
  ├─ @ui-polish tests
  ├─ @analytics-beacons tests
  └─ Upload diagnostics (on failure)
  ↓
full-stack (25 min)
  ├─ Start Docker services (test mode)
  ├─ Wait for health checks
  ├─ Full Playwright suite
  ├─ Collect diagnostics (on failure)
  └─ Upload all artifacts
  ↓
Merge to main
```

---

## Files Changed

### New Files
1. **`scripts/collect-diag.ps1`** - Diagnostic collection script
2. **`.env.test.example`** - Example local config overrides
3. **`.github/workflows/e2e-hermetic.yml`** - Split fast/full workflow

### Modified Files
1. **`scripts/test-all.ps1`** - Added .env.test loader
2. **`scripts/test-all.sh`** - Added .env.test loader
3. **`package.json`** - Added npm wrapper scripts
4. **`.github/workflows/e2e-ui-polish.yml`** - Added diagnostic collection

---

## Troubleshooting

### Diagnostics not collected in CI

**Problem**: `collect-diag.ps1` fails in CI

**Solution**: Ensure PowerShell is available in the runner:
```yaml
- name: Collect diagnostics
  if: failure()
  shell: pwsh  # Important!
  run: pwsh ./scripts/collect-diag.ps1
```

### .env.test not loading

**Problem**: Environment variables not set

**Solution**: Check file format:
- Use `KEY=VALUE` format (no spaces around `=`)
- No quotes needed for values
- Comment lines start with `#`
- Empty lines are ignored

**Valid:**
```bash
BASE_URL=http://localhost:8080
PLAYWRIGHT_GLOBAL_SETUP_SKIP=1
# This is a comment
```

**Invalid:**
```bash
BASE_URL = "http://localhost:8080"  # Spaces and quotes
PLAYWRIGHT_GLOBAL_SETUP_SKIP = 1
```

### Container logs missing

**Problem**: Diagnostics bundle doesn't include container logs

**Solution**: Check container names in `collect-diag.ps1`:
```powershell
# List running containers
docker ps --format "{{.Names}}"

# Update container list in collect-diag.ps1
-Containers @('your-container-1','your-container-2')
```

### npm wrappers fail on Linux

**Problem**: PowerShell not available on Linux

**Solution**: Use bash script directly or install PowerShell:
```bash
# Option 1: Use bash script
./scripts/test-all.sh --frontend-only

# Option 2: Install PowerShell on Linux
# https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-linux
```

---

## Best Practices

### 1. Always collect diagnostics on CI failure
```yaml
- name: Collect diagnostics (on failure)
  if: failure()
  shell: pwsh
  run: pwsh ./scripts/collect-diag.ps1
```

### 2. Use .env.test for local customization
- Never commit `.env.test` to git
- Document common overrides in `.env.test.example`
- Use it for per-developer settings

### 3. Run frontend tests first locally
```bash
# Fast feedback loop
npm run test:all:frontend
# Then full suite if needed
npm run test:all
```

### 4. Set artifact retention appropriately
```yaml
- uses: actions/upload-artifact@v4
  with:
    retention-days: 7  # Balance cost vs debugging needs
```

### 5. Use split lanes in CI
- Fast lane: Quick feedback
- Full lane: Comprehensive validation
- Only run full lane after fast passes

---

## Performance Metrics

| Test Mode | Time | When to Use |
|-----------|------|-------------|
| `test:all:frontend` | ~5 min | CSS/UX changes, rapid iteration |
| `test:all:skip-infra` | ~8 min | Backend already running |
| `test:all` (full) | ~15 min | Complete validation |
| CI fast-frontend | ~5 min | Every PR |
| CI full-stack | ~25 min | After fast passes |

---

## Future Enhancements

1. **Parallel test execution** - Shard tests across multiple runners
2. **Test result caching** - Skip unchanged tests
3. **Progressive screenshots** - Visual regression on key frames
4. **Performance budgets** - Fail on slow loading
5. **Automatic retry logic** - Smart flaky test handling

---

## References

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [GitHub Actions Artifacts](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts)
- [PowerShell Environment Variables](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables)
- [Docker Compose Override](https://docs.docker.com/compose/multiple-compose-files/)
