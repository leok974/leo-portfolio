# PR Checklist (Backend RAG)

- [ ] Cache + invalidation works (`tests/test_cache_roundtrip.py` PASS)
- [ ] Pagination params (`limit`, `offset`) + `next_offset` verified
- [ ] Batch ingest (PDF/HTML/TXT/Images) with smart extract works
- [ ] CLI shows `ingest`, `rebuild-index`, `vacuum-analyze`
- [ ] Snippet highlighting via `highlight()` with cropping
- [ ] Fusion scoring guard (no ZeroDivisionError) + tie-break stability
- [ ] OpenAPI drift guard workflow green; snapshot refreshed
- [ ] Perf guard test in place (optional CI)
- [ ] README Quickstart + `docs/maintenance.md` present
