# Changelog

## [Unreleased] - 2025-01-25

### Analytics Dashboard, Adaptive Autotuning, and Scheduler Extensions (Phase 50.3 🎯📊🤖)
- **AB Analytics Dashboard**: Visual CTR insights with Recharts
  - Event storage: `ab_store.py` with JSONL persistence (`data/ab_events.jsonl`)
  - Daily CTR aggregation: `summary(from_day, to_day)` with date filtering
  - API endpoint: `GET /agent/ab/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Frontend component: `ABAnalyticsDashboard.tsx` (Recharts line chart)
  - Features: Daily CTR trends, overall stats cards, winner display, date filters, refresh button
  - Responsive design: Grid layout, mobile-friendly inputs, 100% width chart
- **Adaptive Agentic Feedback Loop**: AI-driven weight optimization
  - Autotuning service: `weights_autotune.py` with learning rate alpha
  - Algorithm: `new_weight = max(0, base + alpha * hint)` then normalize to 1.0
  - API endpoint: `POST /agent/autotune?alpha=0.5` (default alpha: 0.5)
  - Frontend component: `AutotuneButton.tsx` with loading state and feedback
  - Safety: Non-negative weights, gradual updates controlled by alpha
  - Integration: Dispatches `siteagent:layout:updated` event to refresh admin badge
- **Scheduler Extensions**: YAML policy and manual triggers
  - YAML configuration: `data/schedule.policy.yml`
  - Settings: `nightly_time: "02:30"`, weekday/weekend/holidays presets, custom holiday list
  - Enhanced `scheduler.py`: `pick_preset_for_day(date)` for day-type selection
  - Manual trigger: `POST /agent/run_now?preset=X` for immediate optimization
  - Audit trail: `agent_events.py` with JSONL logging (`data/agent_events.jsonl`)
  - API endpoint: `GET /agent/events?limit=50` for event history
  - Event types: `scheduler_run`, `manual_optimize`, `autotune`
- **Test Coverage**: 16 new tests (48 total)
  - Backend: 8 tests (all passing in 0.10s)
    - `test_ab_summary.py` (4 tests): Event logging, daily CTR, date filtering, empty state
    - `test_autotune.py` (4 tests): Normalization, alpha, non-negative, zero alpha
  - E2E: 8 tests created (ab-dashboard.spec.ts, autotune.spec.ts)
    - Dashboard: Render, date filters, refresh button, chart display
    - Autotune: Render, trigger request, error handling, event dispatch
- **Dependencies**: Recharts (3.2.1) installed, PyYAML (6.0.2) already present
- **Architecture**:
  - New files: `ab_store.py`, `agent_events.py`, `weights_autotune.py`, `schedule.policy.yml`
  - Frontend: `ABAnalyticsDashboard.tsx`, `AutotuneButton.tsx` (integrated into `render-admin.tsx`)
  - Enhanced: `scheduler.py` (YAML parsing), `ab.py` (/summary), `agent_public.py` (3 endpoints)
  - All dev/admin-gated: No public exposure of analytics or autotuning
- **Branch**: `PHASE-50.3` (commit: pending)

### Layout Optimization Advanced Features (Phase 50.2 🎯🔬)
- **Sticky A/B Assignment**: Deterministic bucketing for consistent user experience
  - SHA1-based bucketing: `bucket_for(visitor_id)` → deterministic 50/50 split
  - Accept `visitor_id` query param and `X-Visitor-Id` header in `/agent/ab/assign`
  - Ensures same visitor always gets same bucket across sessions
  - Frontend integration: `crypto.randomUUID()` stored in localStorage + cookie
- **Nightly Scheduler**: Automated layout optimization
  - Async scheduler running at 02:30 daily
  - Weekday (Mon-Fri) → `recruiter` preset (high signal/media)
  - Weekend (Sat-Sun) → `hiring_manager` preset (high fit/freshness)
  - Guard: `SCHEDULER_ENABLED=1` environment variable
  - Integrated into FastAPI lifespan context
  - Error handling: 1-hour retry delay on failure
- **Overlay Weight Editor**: Interactive weight tuning with approval workflow
  - Weight management service: `layout_weights.py`
  - Active/proposed weight storage: `data/layout_weights.{active,proposed}.json`
  - Workflow: Save proposal → Review → Approve → Activate
  - API endpoints:
    - `GET /agent/layout/weights`: Get active and proposed weights
    - `POST /agent/layout/weights/propose`: Save proposed weights
    - `POST /agent/layout/weights/approve`: Activate proposed weights
    - `POST /agent/layout/weights/clear`: Clear proposal without activating
  - Weight precedence in `run_layout_optimize`: payload.weights > active > preset
  - Frontend ready: Sliders with normalization + save/approve/optimize buttons
- **Test Coverage**: 10 new tests (32 total, all passing in 0.23s)
  - `test_ab_sticky.py` (3 tests): Deterministic bucketing, visitor consistency
  - `test_scheduler_pick.py` (3 tests): Next run time calculation (before/after/at 02:30)
  - `test_weights_editor.py` (4 tests): Propose, approve, clear, error handling
  - All existing tests still passing (22 tests)
- **Architecture**:
  - New files: `scheduler.py` (82 lines), `layout_weights.py` (82 lines), `layout_weights.py` router (60 lines)
  - Modified: `layout_ab.py` (SHA1), `ab.py` (visitor_id), `layout_opt.py` (active weights), `main.py` (mount), `lifespan.py` (scheduler)
  - Breaking changes: `assign_bucket(visitor_id)` now uses SHA1 instead of `hash()`
- **Branch**: `LINKEDIN-OPTIMIZED` (commit: `b5b534a`)

### Layout Optimization Extensions (Phase 50.1 🎯✨)
- **Preset System**: Audience-specific optimizations
  - `default`: Balanced weights (35/35/20/10), 3 featured
  - `recruiter`: High signal/media (45/15), 4 featured - emphasize popularity
  - `hiring_manager`: High fit/freshness (25/40), 3 featured - emphasize relevance
  - `select_preset(name)` function for dynamic preset selection
- **Layout Sections (v2 Format)**: Featured/more split
  - `sections.featured`: Top N projects for above-the-fold hero display
  - `sections.more`: Remaining projects for below-the-fold grid
  - Backward compatible: `order` field preserved for legacy readers
  - Metadata: `preset` and `version: 2` tracked in output
- **A/B Testing Infrastructure**: Data-driven weight optimization
  - `assign_bucket(visitor_id)`: Consistent bucket assignment (A or B)
  - `record_event(bucket, event)`: Track views and clicks
  - `suggest_weights()`: CTR analysis with weight adjustment hints
  - State persistence: `data/layout_ab_state.json`
  - API endpoints: `/agent/ab/assign`, `/agent/ab/event`, `/agent/ab/suggest`, `/agent/ab/reset`
- **PR Automation**: GitHub integration for layout updates
  - `layout.apply` task: Commit layout to feature branch
  - `pr.create` task: Open GitHub PR via API
  - Environment vars: `GITHUB_TOKEN`, `GITHUB_REPO`
  - Git operations: branch creation, commit, push, PR creation
- **Agent API Extensions**: Task-based execution
  - `ActReq` model: Support both `command` (NL) and `task` + `payload` (direct)
  - Direct task execution: `{task: "layout.optimize", payload: {preset: "recruiter"}}`
  - Natural language still supported: `{command: "optimize layout"}`
- **Test Coverage**: 20 new tests (24 total, all passing in 0.17s)
  - `test_layout_sections.py` (9 tests): Preset validation, section splitting
  - `test_layout_ab.py` (11 tests): Bucket assignment, event tracking, CTR
  - Updated `test_layout_optimize.py` (4 tests): Weights parameter, v2 format
- **Architecture**:
  - New files: `layout_ab.py`, `pr_utils.py`, `ab.py` router
  - Modified: `layout_opt.py` (presets), `agent_public.py` (tasks), `main.py` (mount)
  - Breaking changes: `score_projects(weights)`, `propose_layout(featured_count, preset_name)`
- **Branch**: `LINKEDIN-OPTIMIZED` (commit: `be4e453`)

### Layout Optimization System (Phase 50 🎯)
- **Multi-Factor Scoring Algorithm**: Intelligent project ranking
  - Freshness (35%): Exponential decay, 30-day half-life
  - Signal (35%): Stars/forks/views with log compression
  - Fit (20%): Role-specific keyword matching (ai/ml/swe)
  - Media (10%): Thumbnail + OG image quality
- **Task Integration**: `layout.optimize` registered in agent system
  - Natural language: "optimize layout [for roles]"
  - Agent endpoint: `POST /agent/act` with command
  - Automatic artifact generation + git diff
- **Generated Output**: `assets/layout.json`
  - Ordered project slugs (sorted by score)
  - Detailed scoring explanations with rationale
  - Version + timestamp metadata
- **Supporting Services**: New utility modules
  - `artifacts.py`: Timestamped JSON artifact writing
  - `git_utils.py`: Git diff generation for changes
  - `text.py`: Slugify for URL-safe names
- **Data Structure Handling**: Flexible input parsing
  - Handles dict format (slug->project mapping)
  - Handles array format (project list)
  - Graceful degradation for missing fields
- **Test Coverage**: 4 new tests (all passing in 0.03s)
  - Full scoring workflow validation
  - Empty projects edge case
  - Role-specific keyword matching
  - Freshness decay calculation
- **Bug Fixes**:
  - Fixed duplicate return in `agent_public.py`
  - Added projects.json dict-to-list normalization
- **Branch**: `LINKEDIN-OPTIMIZED` (commit: `3e525a5`)

### LinkedIn Resume Generator (Phase 49 📄)
- **Public Resume Endpoints**: No authentication required
  - `GET /resume/generate.md`: LinkedIn-optimized markdown resume
  - `GET /resume/generate.json`: Structured JSON + markdown
  - Auto-download with timestamped filename: `resume-2025-01-25.md`
- **Dual Content Loading**: Resilient data sourcing
  - Primary: `projects.json` (structured data)
  - Fallback: `index.html` (regex extraction from data attributes)
  - Graceful degradation when structured data unavailable
- **Skills Extraction**: Union strategy
  - Extracts unique tags from all project `tags` fields
  - Adds core stack keywords (AI Engineering, FastAPI, Docker, etc.)
  - Alphabetically sorted, deduplicated
- **Featured Project Prioritization**: Rank-based ordering
  - Featured: SiteAgent, Derma AI, DataPipe AI, LedgerMind (appear first)
  - Configurable via `featured_order` array
- **Agent Tools UI**: New "Resume" tab
  - "Generate Markdown" button → Auto-downloads `.md` file
  - "View JSON" button → Shows structured data in preview
  - Status indicator (Generating… / Done / Failed)
- **Test Coverage**: 5 new tests (all passing in 0.47s)
  - 404 handling (no content)
  - JSON structure validation
  - Featured project ordering
  - Markdown generation with projects
- **Branch**: `LINKEDIN-OPTIMIZED` (commit: `be28dc5`)
- **Documentation**: PHASE_49_RESUME_GENERATOR.md (complete specification)

## [Unreleased] - 2025-01-20

### Media Management & Link Suggestion Tasks (Phase 44 📸)
- **media.scan Task**: Automated media indexing
  - Scans all images under `public/` and `assets/` directories
  - Supports: PNG, JPG, JPEG, WEBP, GIF, SVG, BMP, TIFF
  - Records metadata: path, size (bytes), dimensions (width×height), format, SHA1 hash, mtime
  - Dimension detection: SVG regex parsing + Pillow for raster images
  - Output: `assets/data/media-index.json` sorted by size (largest first)
  - Natural language: `scan media`
- **media.optimize Task**: WebP conversion + responsive thumbnails
  - Creates WebP versions + thumbnails (480w, 960w) to `assets/derived/`
  - Converts raster images with configurable quality (default 82)
  - Generates responsive thumbnails with LANCZOS resampling
  - Skips: SVG, GIF (animated), existing files (unless `overwrite=true`)
  - Params: `quality` (1-100), `limit` (max files), `overwrite` (bool)
  - Requires: Pillow (graceful skip if missing)
  - Natural language: `optimize images` / `optimise pictures`
- **links.suggest Task**: Intelligent broken link fix suggestions
  - Reads broken links from `link-check.json`
  - Fuzzy filename matching using `difflib` (similarity ≥ 60%)
  - Extension-aware filtering for better matches
  - Generates top 5 suggestions per missing link
  - Output: `assets/data/link-suggest.json`
  - Natural language: `suggest link fixes` / `recommend link fix`
- **Dev Overlay Integration**: 3 new quick-access buttons
  - "Scan media" button: Run media.scan + auto-focus
  - "Optimize images" button: Run media.scan + media.optimize + auto-focus
  - "Suggest link fixes" button: Run links.suggest + auto-focus
  - All buttons use responsive flex-wrap layout
- **Default Plan Update**: Added media.scan to nightly runs
  - Order: projects.sync → **media.scan** → sitemap.media.update → og.generate → news.sync → links.validate → status.write
  - Keeps media index fresh for sitemap and other tasks
- **Natural Language Support**: 3 new command patterns
  - `scan media` → ["media.scan", "status.write"]
  - `optimize/optimise images/pictures/media` → ["media.scan", "media.optimize", "status.write"]
  - `suggest/recommend link fix(es)` → ["links.suggest", "status.write"]
- **Test Coverage**: 7 new tests (18 total passing)
  - test_media_scan_writes_index: Verifies media-index.json creation
  - test_links_suggest_creates_file: Verifies fuzzy matching + suggestions
  - test_parse_scan_media: Natural language parsing
  - test_parse_optimize_images: Natural language parsing (optimize)
  - test_parse_optimize_pictures: Natural language parsing (optimise, British)
  - test_parse_suggest_link_fixes: Natural language parsing (suggest)
  - test_parse_recommend_link_fix: Natural language parsing (recommend)
- **Documentation**: PHASE_44_MEDIA_LINKS.md (complete specification)

### Enhanced Dev Overlay with Event Filtering (Phase 43.3 🎯)
- **Event Filtering**: Filter events by level (info/warn/error)
  - Level dropdown with real-time filtering
  - Shows only selected severity level events
  - Helps isolate errors and warnings quickly
- **Run Tracking**: Focus on specific agent runs
  - Recent runs dropdown with success ratio display
  - Manual run_id input field with apply button
  - Shows "abc12345… (3/5 ok)" format for run selection
- **Focus Button (🎯)**: One-click filtering on any event
  - Appears on each event in the list
  - Instantly filters to show only that run's events
  - Enables quick debugging workflow
- **Auto-Focus After Actions**: Intelligent filtering post-action
  - "Tell agent" button auto-focuses on command's run
  - "Run quick" button auto-focuses on quick-run's events
  - Provides immediate feedback on action results
- **Responsive Layout**: Professional, clean UI
  - flex-wrap buttons for mobile responsiveness
  - Proper spacing and margins
  - Close button with margin-left:auto
- **Backend Support**: New `/agent/events` endpoint
  - Query parameters: `level`, `run_id`, `limit`
  - Returns: `{"events": [...]}` with full event details
  - Limit validation: 1-100 events
  - Public endpoint (no authentication, like `/agent/status`)
- **New Functions**:
  - `query_events()` in models.py: Filtered event retrieval from database
  - `loadRecentRuns()` in index.html: Populate recent runs dropdown
  - `refreshEvents()` in index.html: Fetch and render filtered events
- **Event Format**: Rich event display
  - Level emoji (🟢 info / 🟠 warn / 🔴 error)
  - Timestamp (localized time)
  - Event name (e.g., "logo.fetch.ok")
  - run_id (clickable code block)
  - Data payload (JSON formatted, if present)
- **Test Coverage**: Verified via manual testing
  - Backend: `/agent/events` endpoint tested with curl
  - Frontend: UI controls tested in browser
  - Integration: Auto-focus tested with actual agent commands
- **Documentation**: PHASE_43_3_DEV_OVERLAY.md (complete specification)

### Logo.fetch Security Hardening & Logo Removal (Phase 43.1 🔒)
- **SSRF Protection**: Blocks private/loopback/link-local/reserved IPs
  - Prevents attacks on internal services (AWS metadata, databases, admin panels)
  - Resolves hostnames before fetching to validate IP address
  - Blocks: 10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, multicast, reserved
- **HTTPS Enforcement**: Requires HTTPS by default (configurable)
  - Environment variable: `SITEAGENT_LOGO_ALLOW_HTTP=1` to allow HTTP
  - Prevents man-in-the-middle attacks on logo downloads
- **Host Allowlist**: Optional suffix-based host filtering
  - Environment variable: `SITEAGENT_LOGO_HOSTS=github.com,cdn.example.com`
  - When set, only allows logos from specified domains
  - Suffix matching: `raw.githubusercontent.com` matches `githubusercontent.com`
- **SVG Sanitization**: Strips malicious elements and attributes
  - Removes `<script>` and `<foreignObject>` tags
  - Removes all `on*` event attributes (onclick, onload, etc.)
  - Prevents XSS attacks via SVG injection
- **Configurable Size Limits**: Environment-based max file size
  - Environment variable: `SITEAGENT_LOGO_MAX_MB=3` (default 3MB)
  - Two-stage validation: Content-Length header + streaming check
  - Prevents disk space exhaustion attacks
- **Logo Removal Support**: Remove logo mappings without deleting files
  - Natural language: `remove logo for repo X` or `remove logo for Title`
  - API: `params.logo = {repo/title, remove: true}`
  - Deletes mapping from og-overrides.json, regenerates OG images
- **New Environment Variables**:
  - `SITEAGENT_LOGO_MAX_MB`: Max logo file size in MB (default 3)
  - `SITEAGENT_LOGO_ALLOW_HTTP`: Allow plain HTTP downloads (default false)
  - `SITEAGENT_LOGO_HOSTS`: Comma-separated host suffixes (optional)
- **Test Coverage**: 4 additional security tests
  - test_logo_fetch_blocks_private_ip: SSRF guard validation
  - test_remove_logo_mapping: Logo removal via overrides.update
  - test_interpret_remove_logo_for_repo: Remove command parsing (repo)
  - test_interpret_remove_logo_for_title: Remove command parsing (title)
  - All 20 tests passing (9 logo.fetch + 11 interpreter)
- **Documentation**: LOGO_FETCH_SECURITY.md (comprehensive security guide)

### Logo.fetch Task - URL-Based Logo Downloads (Phase 43 ✨)
- **New logo.fetch Task**: Automated logo downloading from URLs
  - Downloads from any http(s) URL with size validation (default 3MB cap)
  - Content-Type detection: png, jpeg, webp, svg, gif
  - Optional Pillow integration: Converts raster formats to PNG
  - Automatic save to `./assets/logos/<slug>.<ext>`
  - Automatic registration in `og-overrides.json`
  - Parameters: `url` (required), `repo`, `title`, `name`, `max_bytes`
  - Returns: `{file, ctype, mapped}` with download results
- **Interpreter URL Routing**: Natural language commands for logo fetching
  - `fetch logo for repo X from https://...` → Routes to `logo.fetch`
  - `set logo for repo X to assets/...` → Routes to `overrides.update`
  - Detects http:// or https:// to choose correct task
  - Maintains backward compatibility with existing commands
- **Dev Overlay Enhancement**: Added URL fetch example to placeholder
- **Test Coverage**: 5 comprehensive tests (mock fetch, routing, validation)
  - All 16 logo.fetch + interpreter tests passing
  - Mock HTTP responses (no external dependencies)
  - Temp directory isolation (no file system pollution)

### SiteAgent Enhanced Tasks - OG Images, News Feed, Link Validation (NEW ✨)
- **Three New Automated Tasks**:
  1. **og.generate** - Playwright-based Open Graph image generator
     - Creates 1200×630px social preview images from `projects.json`
     - Glassmorphic card design with project title, description, topics
     - Template: `public/og/template.html` with dark gradient background
     - Script: `scripts/og-render.mjs` (Headless Chromium automation)
     - Output: `./assets/og/*.png` (one per project)
     - Graceful fallback when Node/Playwright unavailable
     - Skips existing images for performance
  2. **news.sync** - GitHub releases/commits aggregator
     - Fetches 5 most recent releases via `gh api`
     - Falls back to recent commits if no releases
     - Output: `assets/data/news.json` for frontend consumption
     - Supports multiple repos via `SITEAGENT_REPOS` env var
     - Graceful degradation when `gh` CLI unavailable
  3. **links.validate** - Static local link checker
     - Scans HTML files for broken local references
     - Validates href/src attributes point to existing files
     - Output: `assets/data/link-check.json` with broken links
     - Ignores external URLs, handles directory indexes
     - Emits warnings for missing targets
- **Updated Agent Plan**:
  ```python
  DEFAULT_PLAN = [
    "projects.sync",       # GitHub repo metadata
    "sitemap.media.update", # Media asset indexing
    "og.generate",         # Social preview images (NEW)
    "news.sync",           # Activity feed (NEW)
    "links.validate",      # Broken link detection (NEW)
    "status.write",        # Heartbeat JSON
  ]
  ```
- **Configuration**:
  - Added `SITEAGENT_REPOS` to `.env.prod` (repo list for news.sync)
  - OG template: Responsive 1200×630 viewport, system fonts
  - Link checker: Scans `./` and `./public` directories
- **Documentation**:
  - New file: `docs/SITEAGENT_TASKS.md` (comprehensive task guide)
  - Manual run instructions for each task
  - Output format examples and error handling
  - Production deployment notes (Docker, GitHub Actions)
  - Testing and troubleshooting guides
- **Dependencies**:
  - Node.js (for og.generate script)
  - Playwright chromium browser (for screenshots)
  - `gh` CLI (for news.sync, optional)
  - All with graceful fallback if unavailable

### SiteAgent Dual Authentication - CF Access OR HMAC (ENHANCED ✅)
- **Flexible Authentication**: Public `/agent/*` endpoints now accept EITHER authentication method
  - ✅ **Priority 1: CF Access** - Checked first (JWT from Cloudflare Edge)
  - ✅ **Priority 2: HMAC** - Fallback if CF Access not present/invalid
  - Same endpoint serves both admin users and CI/CD workflows
- **Authentication Flow**:
  1. Try CF Access verification (service token or user JWT)
  2. If CF Access fails, try HMAC signature verification
  3. If both fail, return 401 Unauthorized
- **Use Cases**:
  - **Admins**: Use CF Access credentials (same as `/api/admin/agent/*`)
  - **CI/CD**: Use HMAC signature (GitHub Actions, automated scripts)
  - **Both**: Can send both headers (CF Access takes priority)
- **Endpoint Comparison**:
  - `/api/admin/agent/*` - CF Access ONLY (admin-only)
  - `/agent/*` - CF Access OR HMAC (flexible)
- **HMAC Authentication**:
  - Optional shared secret authentication (`SITEAGENT_HMAC_SECRET`)
  - SHA256 signature with constant-time comparison
  - Header: `X-SiteAgent-Signature: sha256=<hex>`
  - No authentication if secret is not set (dev mode)
- **GitHub Actions Workflow**:
  - File: `.github/workflows/siteagent-nightly.yml`
  - Schedule: 03:17 UTC nightly (configurable)
  - Manual dispatch support
  - Automatic HMAC signature generation
  - Secrets: `SITEAGENT_ENDPOINT`, `SITEAGENT_HMAC_SECRET`
- **Public Endpoints** (`/agent/*`):
  - ✅ **GET** `/agent/tasks` - List available tasks
  - ✅ **POST** `/agent/run` - Execute agent (CF Access OR HMAC)
  - ✅ **GET** `/agent/status` - View run history
- **Dev-Only Features**:
  - Trigger button in bottom-right corner (localhost only)
  - One-click agent execution for testing
  - Visual feedback and console logging
- **Security**:
  - CF Access: Zero-trust JWT validation with Cloudflare
  - HMAC: SHA256 signature with constant-time comparison
  - Replay protection (each body produces unique signature)
  - No credentials in requests (only signature or JWT)
  - Optional HMAC enforcement (disabled if secret not set)
- **Implementation**:
  - File: `assistant_api/routers/agent_public.py`
  - Function: `_authorized(req)` - Dual auth dependency
  - Integration: Public router included in `main.py`
  - Dev button: `index.html` (lines 977-1010)
- **Testing**:
  - `test-agent-dual-auth.ps1` - Comprehensive dual auth test suite
  - Tests: CF Access, HMAC, priority logic, no auth rejection
  - Coverage: Valid/invalid credentials, fallback behavior
- **Documentation**:
  - `SITEAGENT_HMAC_SETUP.md` - Updated with dual auth info (400+ lines)
  - Includes: Backend setup, GitHub Actions, local testing, troubleshooting
- **Backward Compatibility**:
  - CF Access endpoints unchanged (`/api/admin/agent/*` still work)
  - No breaking changes to existing functionality

### SiteAgent MVP - Autonomous Portfolio Maintenance (COMPLETE ✅)
- **Agent Infrastructure**: Complete task automation system for portfolio maintenance
  - ✅ **Task Registry**: Decorator-based `@task(name)` pattern for extensibility
  - ✅ **Database Tracking**: SQLite tables (`agent_jobs`, `agent_events`) for observability
  - ✅ **Execution Engine**: Sequential runner with UUID-based runs and error handling
  - ✅ **API Endpoints**: Protected by CF Access service token authentication
- **Default Tasks Implemented**:
  - `projects.sync` - Pull GitHub repo metadata → `projects.json`
  - `sitemap.media.update` - Scan assets → `media-index.json`
  - `og.generate` - Generate OG images (stub)
  - `status.write` - Write heartbeat → `siteAgent.json` ✅ **TESTED**
- **Agent Endpoints** (`/api/admin/agent/*`):
  - ✅ **GET** `/api/admin/agent/tasks` - List available tasks and default plan
  - ✅ **POST** `/api/admin/agent/run` - Execute agent with optional custom plan
  - ✅ **GET** `/api/admin/agent/status` - View recent run history
- **Production Testing**:
  - Service token authentication verified ✅
  - Task execution successful (run_id: `0714ffc9-439e-4d67-9de7-7be21aa6ce16`)
  - Event logging operational
  - Output files generated correctly (`siteAgent.json`)
- **Architecture**:
  - Files: `assistant_api/agent/{__init__,models,tasks,runner}.py`, `assistant_api/routers/agent.py`
  - Integration: Agent router included in `main.py`
  - Security: All endpoints require CF Access (service token or SSO)
  - Storage: SQLite database at `RAG_DB` path
- **Documentation**:
  - `SITEAGENT_MVP_COMPLETE.md` - Complete implementation guide
  - `agent.html` - Agent manifesto page with API documentation
- **Next Steps**:
  - Frontend widget to display agent status
  - GitHub Actions CI/CD integration
  - Enhanced tasks (full implementation of projects.sync, etc.)

### Service Token Authentication - PRODUCTION READY (FIXED ✅)
- **Issue Resolved**: Service token authentication now fully operational
  - ✅ **AUD Mismatch Fixed**: Updated AUD to `931455ccf7b07230bdf7ed30be7f308abd842f28f954a118e75e062a316635d2`
  - ✅ **Principal Extraction Fixed**: Backend now checks `common_name` claim for Client ID
  - ✅ **Allowlist Updated**: Changed from token name to Client ID (`bcf632e4a22f6a8007d47039038904b7.access`)
- **Root Cause Analysis**:
  - **Problem 1**: JWT validation failing with "Audience doesn't match"
  - **Solution 1**: Added debug logging, discovered actual AUD value, updated `.env.prod`
  - **Problem 2**: JWT had `'sub': ''` (empty), but `'common_name'` contained Client ID
  - **Solution 2**: Updated `cf_access.py` to extract principal from `common_name` claim
- **Authentication Flow** (Verified Working):
  ```
  Client → Cloudflare (validates token) → Generates JWT with common_name →
  Backend (validates JWT, checks common_name) → Returns 200 OK
  ```
- **Test Result**:
  ```json
  {"ok": true, "principal": "bcf632e4a22f6a8007d47039038904b7.access"}
  ```
- **Production Configuration**:
  ```env
  CF_ACCESS_AUD=931455ccf7b07230bdf7ed30be7f308abd842f28f954a118e75e062a316635d2
  ACCESS_ALLOWED_SERVICE_SUBS=bcf632e4a22f6a8007d47039038904b7.access
  ```
- **Documentation**:
  - `AUD_MISMATCH_FIX.md` - Root cause analysis
  - `SERVICE_TOKEN_401_STATUS.md` - Debugging guide
  - `SERVICE_TOKEN_REBUILD_STATUS.md` - Rebuild progress

## [Unreleased] - 2025-10-06

### Service Token Support (NON-INTERACTIVE AUTH)
- **Dual Authentication**: Backend now accepts both user SSO and service tokens
  - ✅ **User SSO**: Interactive login via browser (existing)
  - ✅ **Service Tokens**: Non-interactive authentication for CI/CD
  - Both work simultaneously without conflicts
- **Implementation**:
  - `assistant_api/utils/cf_access.py` - Dual authentication logic
  - `ACCESS_ALLOWED_EMAILS` - User email allowlist (existing)
  - `ACCESS_ALLOWED_SERVICE_SUBS` - Service token allowlist (NEW)
  - Returns generic "principal" (email or token name)
- **Service Token Flow**:
  1. Client sends `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers
  2. Cloudflare validates credentials and injects JWT
  3. Backend extracts `sub` claim (service token name)
  4. Backend validates against `ACCESS_ALLOWED_SERVICE_SUBS`
- **Use Cases**:
  - 🤖 Automated gallery uploads from CI/CD pipelines
  - ⏰ Scheduled content updates (cron jobs)
  - 🚀 GitHub Actions integration (no human required)
  - 🔄 Bot-based portfolio management
- **Configuration** (`.env.prod`):
  ```bash
  ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke
  ```
- **Testing**:
  - `test-service-token.ps1` - Automated test script
  - Service token authentication verified ✅
  - Production deployment pending
- **Documentation**:
  - `docs/CF_ACCESS_SERVICE_TOKENS.md` - 400+ line comprehensive guide
  - `SERVICE_TOKEN_IMPLEMENTATION.md` - Implementation summary
  - `PRODUCTION_DEPLOY_SERVICE_TOKEN.md` - Deployment guide
  - `SERVICE_TOKEN_COMPLETE_SUMMARY.md` - Full summary
  - `QUICK_DEPLOY_SERVICE_TOKEN.md` - Quick reference
- **Breaking Changes**:
  - 🔴 `/api/admin/whoami` now returns `{"principal": "..."}` instead of `{"email": "..."}`
  - ⚠️ Update any code expecting `email` field to use `principal`

### Centralized Admin Router (BREAKING CHANGE)
- **Single Privileged Prefix**: All protected operations now under `/api/admin/*`
  - ✅ **GET** `/api/admin/whoami` - Returns authenticated user's email (smoke test)
  - ✅ **POST** `/api/admin/uploads` - File upload with gallery integration
  - ✅ **POST** `/api/admin/gallery/add` - Add gallery items with metadata
- **Router Consolidation**: Merged uploads.py and gallery.py into admin.py
  - Single `APIRouter` with router-level CF Access guard
  - Impossible to forget protection on new endpoints
  - Clear naming: `/api/admin/*` signals privileged operation
- **Security Benefits**:
  - ✅ Single source of truth for authentication
  - ✅ Router-level `dependencies=[Depends(require_cf_access)]` protects all endpoints
  - ✅ CI guard test (`tests/test_admin_guard.py`) ensures protection
  - ✅ Simple to audit and extend
- **Breaking Changes**:
  - 🔴 **Old:** `/api/uploads` → **New:** `/api/admin/uploads`
  - 🔴 **Old:** `/api/gallery/add` → **New:** `/api/admin/gallery/add`
  - ⚠️ Update Cloudflare Access application to use `/api/admin` path
  - ⚠️ Update frontend/test URLs to new paths
- **Migration**:
  - `docs/ADMIN_ROUTER_MIGRATION.md` - Complete migration guide
  - `PRODUCTION_DEPLOY_CF_ACCESS_NEW.md` - Updated deployment steps
  - `test-production.ps1` - Updated with new URLs
  - `tests/test_admin_guard.py` - CI test for route protection

### Cloudflare Access Authentication
- **JWT Verification**: Enterprise-grade authentication for uploads
  - New module: `assistant_api/utils/cf_access.py` (130+ lines)
  - JWKS-based JWT signature verification (RS256/ES256 algorithms)
  - 10-minute public key cache for performance
  - Extracts principal from verified JWT claims
  - **NEW:** Service token support for non-interactive automation
- **Dual Authentication Modes**:
  - **User SSO:** Interactive login with `cloudflared` CLI (email-based)
  - **Service Tokens:** Non-interactive with client ID/secret headers (CI/CD friendly)
- **Configuration**: Environment-based JWT verification
  - `CF_ACCESS_TEAM_DOMAIN` - Cloudflare team domain (required)
  - `CF_ACCESS_AUD` - Application audience tag (required)
  - `ACCESS_ALLOWED_EMAILS` - Email allowlist for user SSO (optional)
  - `ACCESS_ALLOWED_SERVICE_SUBS` - Service token subject allowlist (optional)
- **Security Benefits**:
  - ✅ Enterprise-grade authentication without password management
  - ✅ Multiple identity providers (Google, GitHub, email OTP)
  - ✅ JWT signature verification prevents header spoofing
  - ✅ Centralized access control in Cloudflare dashboard
  - ✅ Audit logs of all authentication attempts
  - ✅ Service tokens for automated workflows (CI/CD, scripts)
  - ✅ No CSRF tokens needed (Cloudflare Tunnel ensures header integrity)
- **Dependencies**: Added `pyjwt[crypto]>=2.9.0` for cryptographic JWT operations
- **Documentation**:
  - `docs/CF_ACCESS.md` - Complete setup and troubleshooting guide
  - `docs/CF_ACCESS_SERVICE_TOKENS.md` - Service token setup and usage (NEW)
  - `CLOUDFLARE_ACCESS_COMMANDS.md` - Quick command reference
  - `PRODUCTION_DEPLOY_CF_ACCESS_NEW.md` - Production deployment guide

### Agent Uploads & Gallery Tools
- **Backend API**: File upload endpoint (`POST /api/uploads`) with gallery integration
  - Multipart form-data support for images and videos
  - Optional gallery card creation via `make_card` parameter
  - Auto-detects file type by extension
  - Stores files in timestamped directories: `public/assets/{uploads,video}/YYYY/MM/`
- **FFmpeg Integration**: Automatic video poster generation
  - Extracts frame at 1 second, scales to 1280px wide
  - Graceful degradation if ffmpeg unavailable
  - Posters stored alongside videos: `filename.mp4` → `filename.jpg`
- **Gallery Management**: Agent-callable endpoint (`POST /api/gallery/add`)
  - Pydantic-validated JSON API for programmatic gallery control
  - Supports all gallery types: image, video-local, youtube, vimeo
  - Enables AI assistant to manage portfolio content autonomously
- **Sitemap Automation**: Automatic refresh after every gallery change
  - Triggers existing `generate-sitemap.mjs` script
  - Media linter validates assets after upload
  - Ensures SEO consistency
- **Frontend Components** (NEW):
  - Attachment button (📎) in chat interface (254 lines vanilla JS)
  - Upload API helpers in `src/api.ts` (TypeScript)
  - CSS styling with dark mode support (101 lines)
  - Automatic initialization in `assistant-dock.ts`
  - Zero dependencies, CSP-compliant
- **E2E Tests** (NEW):
  - 9 comprehensive Playwright tests (100% passing)
  - Coverage: accessibility, upload flow, error handling, security
  - Test fixtures auto-generated (PNG, MP4)
  - File: `tests/e2e/upload-gallery.spec.ts` (380 lines)
- **Documentation**: Comprehensive guides covering:
  - `docs/UPLOADS.md` - Complete API and usage guide
  - `docs/FRONTEND_IMPLEMENTATION.md` - Frontend implementation summary
  - API usage examples, FFmpeg setup, testing strategies
  - Security considerations, deployment checklist

### Calendly Integration & Analytics
- **Calendly booking system**: Added site-wide "Book a call" popup button and dedicated `/book.html` page with inline widget
- **Enhanced features**: Prefill support (URL params + localStorage), UTM tracking (source/campaign/medium), locale support, accessibility (ARIA live regions)
- **Analytics tracking**: Integrated multi-provider analytics (gtag, GTM dataLayer, Plausible, Fathom, Umami) for `calendly_open` and `calendly_inline` events
- **Theme integration**: Simplified `book.html` to inherit global theme system (supports both `html.dark` class and `[data-theme]` attribute)
- **Helper script**: Created `/assets/js/calendly.js` with lazy loading, URL building, and readiness signaling (`window.__calendlyHelperLoaded`)
- **E2E tests**: 16 comprehensive Playwright tests covering basic integration, enhanced features, analytics tracking, theme switching, and privacy
  - `calendly.spec.ts`: 4 basic integration tests
  - `calendly.nice.spec.ts`: 6 enhanced feature tests (prefill, UTM, locale, accessibility)
  - `calendly.analytics-theme.spec.ts`: 2 analytics + theme tests with offline stubs
  - `calendly.privacy.spec.ts`: 4 privacy tests (consent, DNT, GPC) **(NEW)**
- **Documentation**: Created comprehensive guides:
  - `docs/CALENDLY_NICE_TO_HAVES.md` - Feature documentation
  - `docs/CALENDLY_PRIVACY_HARDENING.md` - Privacy & consent guide **(NEW)**

### Privacy & Consent (NEW)
- **Consent banner**: Built-in, lightweight cookie consent UI (190 lines vanilla JS, no dependencies)
  - Shows on first visit, stores preference in localStorage
  - Auto-declines if DNT or GPC enabled (no banner shown)
  - Emits `consent:change` event for Calendly integration
  - Programmatic API: `window.consent.set/get/clear()`
  - 8 comprehensive E2E tests (`consent-banner.spec.ts`)
  - Fully customizable (copy, colors, positioning)
  - **Consent acceptance tracking**: Privacy-compliant analytics (gtag, plausible, fathom, umami) **(NEW)**
- **Manage privacy preferences**: Footer link to re-open banner and change consent after initial choice **(NEW)**
  - Force-clear consent: `window.consent.showBanner(true)` clears localStorage and shows banner
  - Event-driven: `consent:change` triggers Calendly inline widget re-evaluation
  - E2E test: Footer link flow (decline → manage → accept → widget loads)
- **Consent management**: Respects `window.__consent` object from cookie banners (marketing/analytics flags)
- **Browser signals**: Honors Do Not Track (`navigator.doNotTrack`) and Global Privacy Control (`window.globalPrivacyControl`)
- **Graceful fallbacks**: When consent denied or embeds blocked, renders direct booking links instead of iframes
- **Analytics gating**: `trackAnalytics()` checks `consentAllowed()` before sending events to providers
- **GDPR/CCPA compliance**: Explicit consent for analytics, respects GPC for "Do Not Sell" requests
- **Cookie banner examples**: Integration patterns for Osano, OneTrust, Cookiebot
- **12 privacy E2E tests total**: 8 consent banner tests + 4 Calendly privacy tests

### Production Deployment (NEW)
- **Deployment checklist**: Comprehensive 500+ line production checklist (`PRODUCTION_DEPLOY_CHECKLIST.md`)
  - Security headers (HSTS, CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options)
  - Font configuration (Inter + Space Grotesk with preconnect)
  - Calendly verification (popup button + inline widget data attributes)
  - Cache strategy (long-cache for hashed assets, short-cache for HTML)
  - Pre-deployment verification steps
  - Troubleshooting guide
- **Production nginx config**: Ready-to-use config (`deploy/nginx/nginx.calendly-prod.conf`)
  - All security headers with `always` flag
  - CSP allowing Calendly + Google Fonts
  - Long cache (31536000s) for immutable assets
  - GZIP compression
  - API proxy + SSE streaming support
  - HTTPS/TLS configuration (ready to enable)
- **Consent tracking**: Privacy-compliant acceptance rate tracking added to `consent.js`
  - Only tracks AFTER consent given
  - Supports 4 providers: gtag, plausible, fathom, umami
  - No PII sent (only boolean consent flags)
  - Respects DNT/GPC

### Performance Optimization (NEW)
- **IntersectionObserver**: Inline widgets lazy-load when visible (saves bandwidth for above-fold content)
- **Fallback chain**: IntersectionObserver → requestIdleCallback (2.5s timeout) → setTimeout (immediate)
- **Reduced initial load**: Calendly script only loads on-demand when user interacts or scrolls to widget

### Security Headers (NEW)
- **CSP headers**: Added to `index.html` and `book.html` with strict policy allowing only self + Calendly domains
- **Additional headers**: Referrer-Policy (strict-origin-when-cross-origin), X-Content-Type-Options (nosniff), X-Frame-Options (SAMEORIGIN)
- **HSTS recommendation**: Document server-level configuration for Strict-Transport-Security

### Deployment & Operations
- **Deployment checklist**: Created comprehensive `docs/DEPLOYMENT_CHECKLIST.md` with pre-deploy verification, CI/CD guards, post-deploy smoke tests, and troubleshooting
- **CI/CD pipeline**: Added `.github/workflows/ci.yml` with automated E2E tests, backend tests, linting, and build verification
- **Smoke test scripts**: Created `scripts/smoke-test.sh` (Bash) and `scripts/smoke-test.ps1` (PowerShell) for post-deployment validation
  - Tests backend health, RAG diagnostics, Calendly integration, CSP headers, cache configuration, and chat endpoint
  - Provides actionable output with pass/fail/warn indicators and monitoring commands
- **CSP headers**: Added proper Content-Security-Policy to `book.html` allowing Calendly domains (assets, frames, connects)

### Testing Improvements
- **Test reliability**: Switched from network mocking to pre-navigation stubs for deterministic, offline-capable tests
- **Readiness signals**: Added `window.__calendlyHelperLoaded` flag and `calendly:helper-ready` event for robust test synchronization
- **Test attributes**: Added `data-testid` attributes to key elements (`book-call` button, `calendly-inline` container)
- **Fixed assertions**: Updated existing tests to work with simplified `book.html` structure

### UI/UX Polish
- **Typography**: All 8 typography E2E tests passing across cross-platform environments (Windows/Chromium)
- **Accessibility**: Screen reader support with live regions, sr-only CSS class, proper ARIA attributes
- **Theme support**: Light/dark mode with CSS variables, automatic system preference detection
- **Performance**: Defer-loaded Calendly script, lazy widget initialization, optimized font loading with preconnect

## [Unreleased] - 2025-10-03

### Security / Guardrails
- Added prompt‑injection detection with optional enforcement (`GUARDRAILS_MODE=enforce|log`, default enforce; `ALLOW_UNSAFE=1` disables enforcement in dev).
- RAG snippet sanitization now redacts common secret patterns (JWTs, API keys, PEM blocks).
- `/chat` JSON includes `guardrails` snapshot `{ flagged, blocked, reason, patterns[] }`; replies blocked are served as `_served_by: "guardrails"` with a safe message.
- UI shows a tiny 🛡️ badge when a reply is flagged/blocked.
- Tests added: `tests/test_guardrails.py`.

### Added
 - **Analytics**: Added device-split DOW/HOUR path metric (`page_view_by_dow_hour_path_device_total`) with labels `[dow, hour, path_group, device]`; collector wired with device normalization (mobile/tablet/desktop/unknown); timezone handling now robust for Windows (graceful fallback when tzdata missing).
 - **Grafana**: Dashboard enhanced with 6+ new panels (path group × hour heatmap, device activity rate stacked + sparkline, path × device timeseries/heatmap/table); template variables added (`win`, `rw`, `topk`) with dynamic query updates; collapsed Help row documents variable usage.
 - **Testing**: Playwright e2e tests for analytics beacons (`tests/e2e/analytics-beacons.spec.ts`) with route interception to validate `page_view`, `scroll_depth`, `link_click`, and `dwell` beacons without backend; beacon capture utility (`tests/e2e/utils/beacons.ts`); metrics smoke test (`tests/e2e/metrics.smoke.spec.ts`); new npm scripts `test:analytics` and `test:analytics-beacons` (requires static server on 5173).
 - Backend test `tests/test_chat_rag_grounded.py` asserts grounded chat behavior after FS ingest using an isolated SQLite DB and no-LLM mode.
 - Heartbeat-aware SSE client: `onHeartbeat` support, dynamic grace window via `VITE_SSE_GRACE_MS`, model-aware bump.
 - New UI spec `tests/e2e/assistant-ui-first-chunk.spec.ts` ensures no console warnings when first token arrives timely.
 - Chat API now supports `include_sources` in requests. JSON responses include `grounded` and optional `sources`; SSE `meta` event carries `grounded` and (optionally) `sources`.
 - Assistant dock shows a "grounded (n)" badge next to the served-by marker when grounding is active; it renders immediately on SSE meta and persists across JSON fallback. Falls back to a gentle hint when the reply is intentionally non-grounded.
 - Sources popover: lists title — path and links out when a `url` is present. Test updated to validate link hrefs.
 - Backend enriches source items with `title`, `id`, `path`, and optional `url` (constructed via `RAG_REPO_WEB` + `/blob/<ref>/<path>` when set).
### UI
 - RouteBadge: add per-route chip accents (border + subtle tinted background) and maintain compact variant; tooltip retains backend and reason details.
 - Tools panel: add a "Run (dangerous)" button next to Dry-run. It executes `run_script` without `dry_run` after a confirmation prompt and respects backend guardrails: `ALLOW_TOOLS=1`, `ALLOW_SCRIPTS` allowlist, and optional pre-flight repo cleanliness/ahead-behind gates.
 - Tools panel polish: Pre-flight glimpse shows git branch/dirty/ahead/behind with color-coded hint and legend; preset script selector sourced from allowlist.
 - Admin Eval widget: floating dock card shows latest pass ratio, a tiny trend chart of historical eval runs, and a one-click "Run eval" button that triggers `/api/eval/run`.
 - Admin Eval widget: swapped native `<select>` to shadcn/Radix Select for consistent styling and accessibility. E2E spec updated to interact with the portal menu using role-based queries and to poll `/api/eval/history` for completion.

### Features
- Tools registry with audit and guardrails (safe BASE_DIR sandbox). Added built-in tools: search_repo, read_file, create_todo. New endpoints: GET /api/tools and POST /api/act. Chitchat branch auto-detects repo questions and uses tools to summarize results in /chat responses (actions transcript included).
 - Dangerous tool `run_script` added: requires `ALLOW_TOOLS=1` and an `ALLOW_SCRIPTS` allowlist. `/api/tools/exec` now refuses dangerous tools when gating is off. AdminRebuildButton triggers `scripts/rag-build-index.ps1` and surfaces exit code + stdout/stderr tail.
 - Eval runner upgraded: supports multiple files, plan-type cases, history append to `data/eval_history.jsonl`, and emits git/build metrics.
 - Planning evals added at `evals/tool_planning.jsonl` verifying tool presence and first-step shape.
 - Backend endpoints `/api/eval/history` and `/api/eval/run` expose eval history and allow on-demand runs.

### Changed
 - Streaming completion ensures an `.assistant-meta` footer exists and renders a default route badge even if no SSE `meta` was observed, improving determinism for UI tests.
 - Backend SSE emits an immediate heartbeat and pings until first token; nginx config hardened for SSE.
 - Status summary now includes top-level "ok" boolean and preserves `last_served_by` provider hint for UI/diagnostics.
 - `/status/cors` returns richer payload: `raw_env`, `allow_all`, derived origins from `DOMAIN`, `request_origin` and `is_allowed` (when available), plus timestamp.
 - Chat JSON responses are post-processed to guarantee a follow-up question is present in the assistant content when the model omits one.

### Fixed
 - Popover visibility: toggle inline `style.display` along with `[hidden]` and class changes to satisfy strict Playwright visibility assertions across browsers.
 - Lifespan cleanup: switched to task cancellation + `asyncio.gather` and added `SAFE_LIFESPAN` guard to avoid probing when disabled. Eliminates `Passing coroutines is forbidden` and `Event.wait was never awaited` warnings on Windows.
 - Gen metrics stamping: corrected indentation in `assistant_api/llm_client.py` so successful fallback completions record `stage_record_ms("gen", "openai", ms)` and increment provider counters reliably; primary path already stamps `gen` as `local` on success.
 - Diagnostics consistency in no-LLM mode: when `DEV_ALLOW_NO_LLM` synthesizes a reply (bypassing providers), we now stamp `LAST_PRIMARY_ERROR="simulated"` and `LAST_PRIMARY_STATUS=500` if unset so tests and status endpoints consistently observe a non-None primary error after a simulated failure.
 - Windows startup: FAISS import is now optional. When `faiss` is not installed, the backend still starts; dense search returns empty and RAG falls back to BM25 + brute-force. Build index returns `reason: "faiss not installed"`.
 - New env switch `RAG_DENSE_DISABLE=1` forces dense search off even if FAISS is available (useful for CI or quick dev on Windows).
 - FTS5 fusion query: replaced alias `f MATCH ?` with table name `chunks_fts MATCH ?` to satisfy SQLite FTS5 syntax. Also switched snippet generation from `offsets()` to `highlight()` due to context limitations; snippet highlight test now passes.
 - RAG fusion scoring guard: prevent ZeroDivisionError by clamping bm25 ranks and using a safe inverse weighting. Combined test runs no longer fail intermittently.
 - CI: Fixed `.github/workflows/openapi-drift.yml` duplicate `on/jobs` sections resulting in YAML linter errors; consolidated into a single clean job.

### Infrastructure / RAG ingest
 - In-process fallback for `auto_rag.fetch_context` enables deterministic tests without network dependencies; `/chat` supports `DEV_ALLOW_NO_LLM` to synthesize a minimal grounded response for CI.

### Added
- Endpoint `GET /api/rag/projects` to list distinct project IDs with chunk counts. Includes optional `include_unknown=true` to fold empty/null into an `unknown` bucket. Backend ensures an index on `chunks(project_id)` via `ensure_chunk_indexes()` for fast enumeration.

- Analytics: Track outbound link clicks via `link_click_total{kind, href_domain}`. Collector handles `type: "link_click"` with a low-cardinality kind whitelist (`github`, `artstation`, `resume`, else `other`). Frontend beacon auto-detects anchor clicks for GitHub/ArtStation/Resume links and sends `sendBeacon` events; PowerShell quick-check and PromQL examples added in `docs/analytics.md`.
 - Analytics: Server-side resume download counter `resume_download_total` with `/dl/resume` route that serves the PDF and increments counter (works even with JS disabled). Tests and PromQL example included.
 - Analytics: Device-split DOW/HOUR path metric `page_view_by_dow_hour_path_device_total{dow,hour,path_group,device}` to visualize time-of-day patterns by device without inflating label cardinality. Docs updated with PromQL examples.

### Docs
 - API: Documented `/api/tools/exec`, `run_script` body/response, and gating.
 - Deploy: Added env examples for `ALLOW_TOOLS`/`ALLOW_SCRIPTS` and admin rebuild usage.
 - Security: Noted tools sandbox, allowlist, and audit logging.
 - Eval: Added minimal evals at `evals/baseline.jsonl`, runner `scripts/eval_run.py`, pytest smoke `tests/test_eval_min.py`, and npm scripts `eval:local` and `test:eval`.
	- Eval: Introduced `evals/regression.jsonl` and scripts `eval:regress` / `eval:full` to keep baseline tight and track new regressions.
 - API: Documented Eval API endpoints and example bodies/responses.
 - Dev: Added local eval e2e guidance with a proxy-based workflow to avoid `/api/*` 404s when serving `dist/` directly. New npm script `serve:dist:proxy` and helper `e2e:eval:proxy`.

### Feedback
- Backend: Added feedback endpoints — POST `/api/feedback`, GET `/api/feedback/recent`, GET `/api/feedback/export.csv` (stored in `data/feedback.jsonl`).
- UI: Thumbs bar appears under assistant replies to capture quick 👍/👎. Posts include question, answer, served_by, and grounding metadata.
- Admin: New Admin Feedback widget shows pass ratio of 👍, recent items (👎 by default), and quick refresh.
- Scripts: `scripts/feedback_to_regress.py` converts 👎 items into `evals/regression.jsonl` cases to tighten baseline over time.
