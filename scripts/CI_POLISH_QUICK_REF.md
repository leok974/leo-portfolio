# CI Polish - Quick Reference Card

## ⚡ Fast Commands

```bash
# Test changed files only
npm run test:changed

# Quarantine: flaky tests (allowed to fail)
npm run test:quarantine

# Non-quarantine: stable tests only
npm run test:non-quarantine

# Parallel shards (2 terminals)
npm run test:shard:1
npm run test:shard:2

# Production health check (1 liner)
pwsh ./scripts/tunnel-probe.ps1
```

## 🏷️ Test Tags

```typescript
// Quarantine flaky test (won't block PRs)
test('@quarantine - Flaky timeout', async ({ page: _page }) => {
  // Test code...
});

// Slow test (run nightly, not on PR)
test('@slow - Full data ingestion', async ({ page: _page }) => {
  test.setTimeout(120_000);
  // Test code...
});

// UI polish test (10s nav timeout)
test('@ui-polish - Button hover animation', async ({ page: _page }) => {
  // Test code...
});
```

## 📊 CI Behavior

| Environment | Retries | Trace | Video | Fail-Fast |
|-------------|---------|-------|-------|-----------|
| Local | 0 | retain-on-failure | off | No |
| CI | 2 | on-first-retry | on-first-retry | Yes (--max-failures=1) |

## 🔍 Debugging Failed CI

1. **PR Annotations** - See failures inline in PR
2. **HTML Report** - Download artifact → open index.html
3. **Diagnostics Bundle** - Container logs + health checks
4. **JUnit XML** - Structured test results

## 🚀 Performance

| Scenario | Speed |
|----------|-------|
| Fail-fast (first test fails) | 2 min (87% faster) |
| Frontend-only | 30 sec (83% faster) |
| 4 shards (100 tests) | 5 min (75% faster) |

## 📝 Workflow Matrix

```yaml
# In .github/workflows/e2e-sharded.yml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4
```

## 🎯 Best Practices

✅ **DO**:
- Tag flaky tests as `@quarantine`
- Monitor quarantine workflow daily
- Use fail-fast in CI
- Keep HTML reports for 7 days

❌ **DON'T**:
- Leave tests quarantined >2 weeks
- Skip retries in CI
- Upload videos on every run

## 📚 Documentation

- `scripts/CI_POLISH.md` - Complete guide (400+ lines)
- `scripts/CI_POLISH_SUMMARY.md` - Implementation summary
- `README.md` - Quick start

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| HTML report missing | Check `show-report` runs before upload |
| PR annotations missing | Ensure JUnit reporter enabled |
| Quarantine blocks PR | Verify `continue-on-error: true` |
| Sharding uneven | Use same `--shard=X/N` format |

---

**Quick Links**:
- [CI Polish Guide](./CI_POLISH.md)
- [Hermetic Tests](./HERMETIC_TEST_SUMMARY.md)
- [Production Features](./HERMETIC_TEST_PRODUCTION.md)
