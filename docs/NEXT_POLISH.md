# NEXT_POLISH

This document tracks RAG improvements: cache, pagination, fusion, and maintenance.

## Features
- Answer cache keyed by project list and question, with invalidation on ingest per project.
- Pagination for /api/rag/query with limit/offset and next_offset.
- Fusion variants (base, phrase, NEAR) with simple score fusion.
- Stable ordering via tie-break: score DESC, ordinal ASC, created_at DESC.
- Snippet highlighting via FTS5 highlight(), cropped around first match.

## Maintenance
- CLI: rebuild-index (rebuild chunks_fts) and vacuum-analyze.
- Nightly task guidance in docs/maintenance.md.
- OpenAPI drift guard workflow compares exported schema against docs snapshot.

## Flags

| Env               | Default | Effect                 |
|-------------------|---------|------------------------|
| RAG_ENABLE_CACHE  | 1       | Use answers_cache      |
| RAG_ENABLE_FUSION | 1       | Use variants + fusion  |
| RAG_MAX_LIMIT     | 100     | Max per-query results  |
