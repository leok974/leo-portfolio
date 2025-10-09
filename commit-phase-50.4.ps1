git add assistant_api/services/seo_tune.py assistant_api/routers/seo.py assistant_api/tests/test_seo_tune.py assistant_api/main.py docs/PHASE_50.4_SEO_OG_INTELLIGENCE.md docs/PHASE_50.4_IMPLEMENTATION_SUMMARY.md
git commit -m "feat(phase-50.4): SEO & OG Intelligence backend stubs

Phase 50.4 Implementation:
- Service: seo_tune.py with artifact generation (diff + reasoning log)
- Router: POST /agent/run?task=seo.tune + artifacts endpoints
- Tests: test_seo_tune.py with dry-run and content validation
- Main: SEO router registration with soft-fail
- Docs: Complete specification + implementation summary

Ready for LLM/OG/sitemap integration (TODOs marked).

Files created:
- assistant_api/services/seo_tune.py (158 lines)
- assistant_api/routers/seo.py (24 lines)
- assistant_api/tests/test_seo_tune.py (21 lines)
- docs/PHASE_50.4_SEO_OG_INTELLIGENCE.md (124 lines)
- docs/PHASE_50.4_IMPLEMENTATION_SUMMARY.md (256 lines)

Files modified:
- assistant_api/main.py (SEO router registration)

Next: Wire LLM calls, OG generation, sitemap regeneration"
