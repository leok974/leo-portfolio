## Summary
- Adds DISABLE_PRIMARY=1 to bypass Ollama during dev; forces OpenAI fallback in both /chat and /chat/stream.
- Enriches /chat 503 detail with provider HTTP status/body + diag (base URLs, models, key present).
- Points auto-RAG default to 127.0.0.1:8001 in dev; keep RAG_URL overridable for prod.
- Verifies end-to-end with smoke: /ready, /llm/health, /api/rag/query, /chat, /metrics.

## Why
- Makes local iteration reliable even if Ollama isn’t running or lacks /chat/completions.
- Faster troubleshooting with structured diagnostics.
- Ensures hybrid RAG works independently of primary LLM availability.

## Notes
- Prod must set RAG_URL to backend URL (e.g. http://backend:8000/api/rag/query).
- Use Docker secret `openai_api_key` for both embeddings + fallback in prod.
