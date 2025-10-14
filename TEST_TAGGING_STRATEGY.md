# Test Tagging Strategy for SiteAgent vs Portfolio Separation

## Purpose
Separate tests by build target (siteagent vs portfolio) to run appropriate tests in CI against the correct build/port.

## Tag Definitions

### `@siteagent`
Tests that run against the **siteagent build** (port 5173, vite preview, dev overlay features).
- Dev overlay / admin panel tests
- Assistant chat widget tests
- Backend integration tests (chat, RAG, agent tools)
- Agent runner / tools panel tests
- Upload/gallery features
- SEO agent tests (keywords, meta suggestions, status pages)
- Any test requiring `BACKEND_REQUIRED=1`

### `@portfolio`
Tests that run against the **portfolio build** (port 8080, nginx, public site).
- Homepage filter tests (project cards, status filters)
- Calendly integration tests
- Typography tests
- SEO meta tags tests
- CSP tests
- Resume endpoints UI tests
- Consent banner / privacy page tests
- Public smoke tests (social links, navigation)
- AB testing public site tests (toast, winner bold)

### `@smoke`
Fast sanity checks that run before full test suite.
- Homepage loads
- Backend reachable
- Dev overlay exists
- Basic navigation works

## Tagging Rules

1. **Tests with dev overlay / admin tools** → `@siteagent`
2. **Tests with project cards / homepage filters** → `@portfolio`
3. **Tests with `/agent/` API endpoints** → `@siteagent`
4. **Tests with backend streaming chat** → `@siteagent`
5. **Tests with Calendly / public integrations** → `@portfolio`
6. **Tests checking SEO meta tags in HTML** → `@portfolio`
7. **Tests checking backend-generated content** → `@siteagent`
8. **API-only tests (no UI)** → `@siteagent` (backend tests)
9. **Mixed tests** → Tag based on primary feature being tested

## Ambiguous Cases

- **Analytics beacons**: Client-side only (no backend) → `@portfolio`
- **Assistant widget**: Uses backend → `@siteagent`
- **Typography sitewide**: Crawls all pages → `@portfolio` (public site feature)
- **Resume endpoints**: API tests → `@siteagent`, UI tests → `@portfolio`
- **Sitemap/robots.txt**: Static files → `@portfolio`
- **Gallery tests**: Uses backend upload → `@siteagent`

## Port Usage

- **SiteAgent**: `http://127.0.0.1:5173` (vite preview)
- **Portfolio**: `http://127.0.0.1:8080` (nginx)

All tests should use **relative URLs** (`await page.goto('/')`) instead of hardcoded ports.
The playwright project configuration handles the baseURL.

## Implementation Steps

1. ✅ Configure playwright projects with grep filters
2. ⏳ Tag all existing tests
3. ⏳ Remove hardcoded ports
4. ⏳ Update CI workflow
5. ⏳ Verify smoke tests run first

## File Categorization Summary

### Definitely @siteagent
- `01_overlay_smoke.spec.ts` - Dev overlay
- `ab-dashboard.spec.ts` - Admin tools (`@dev-only`)
- `admin.auth.spec.ts` - Admin auth
- `admin.panel.spec.ts` - Admin panel (`@frontend` already)
- `agent-*.spec.ts` - All agent tests
- `api-*.spec.ts` - Backend API tests
- `assistant-*.spec.ts` - Assistant widget tests
- `autotune.spec.ts` - Admin tools (`@dev-only`)
- `chat-*.spec.ts` - Backend chat tests
- `dev-overlay*.spec.ts` - Dev overlay tests
- `eval-run-sets.spec.ts` - Admin eval tests
- `feedback.spec.ts` - Backend feedback
- `guardrails-injection.spec.ts` - Backend validation
- `last-run-badge.spec.ts` - Agent tools (`@frontend`)
- `layout-agent-panel.spec.ts` - Agent tools (`@frontend`)
- `metrics.smoke.spec.ts` - Backend metrics
- `public-smoke.spec.ts` - Backend endpoints (`@public-smoke`)
- `route-badge.spec.ts` - Assistant feature
- `run-now-badge.spec.ts` - Agent tools (`@tools`)
- `seo-analytics*.spec.ts` - SEO agent tests (`@backend`, `@frontend`)
- `seo-keywords*.spec.ts` - SEO agent tests
- `seo-meta*.spec.ts` - SEO agent tests
- `seo-pr-*.spec.ts` - SEO agent PR tests (`@seo`)
- `status-*.spec.ts` - Agent status endpoints
- `tools-panel.spec.ts` - Admin tools
- `upload-*.spec.ts` - Upload features (`@uploads`, `@feature-gate`)
- `weights-editor.spec.ts` - Agent tools (`@frontend`)

### Definitely @portfolio
- `ab-toast.spec.ts` - Public site AB testing
- `ab-winner-bold.spec.ts` - Public site AB testing (`@tools`)
- `analytics.spec.ts` - Public analytics
- `analytics-beacons.spec.ts` - Client beacons (`@analytics-beacons`)
- `calendly*.spec.ts` - Public Calendly integration
- `consent-banner.spec.ts` - Public consent (`@consent-banner`)
- `csp.spec.ts` - CSP headers
- `gallery*.spec.ts` - Public gallery (`@gallery`, `@schema`)
- `home-filter.spec.ts` - Homepage filters (`@frontend`)
- `portfolio.smoke.spec.ts` - Portfolio smoke tests
- `privacy-page.spec.ts` - Privacy page (`@privacy-page`)
- `resume-endpoints.spec.ts` - Resume UI tests (API tests → `@siteagent`)
- `seo.spec.ts` - SEO meta tags (HTML)
- `sitemap*.spec.ts` - Sitemap/robots
- `typography-sitewide.spec.ts` - Typography tests
- `ui-assistant-chip.spec.ts` - Assistant chip UI
- `ui-polish.spec.ts` - UI polish (`@ui-polish`)

### Mixed (needs analysis)
- `02_act_brand.spec.ts` - ?
- `03_link_artifacts.spec.ts` - ?
- `04_og_renderer.spec.ts` - ?
- `assistant.sse.spec.ts` - Assistant widget → `@siteagent`
- `assistant.stream.spec.ts` - Assistant widget → `@siteagent`
- `test-*.spec.ts` - Debug tests (check individually)

## Next Actions

1. Bulk tag obvious categories
2. Manually review mixed tests
3. Remove hardcoded port references
4. Test locally with `npm run e2e:ci` vs `npm run e2e:portfolio`
5. Commit and push for CI validation
