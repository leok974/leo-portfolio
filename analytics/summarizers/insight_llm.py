"""
LLM-based insight generation using local Ollama (gpt-oss-20b compatible).

Phase 51.0 — Analytics Loop
"""
from __future__ import annotations
import os


def _client():
    """
    Get OpenAI-compatible client configured for local Ollama.

    Returns:
        Tuple of (client, model_name)
    """
    import openai

    # Primary: Local Ollama
    base = os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:11434/v1")
    key = os.getenv("OPENAI_API_KEY", "not-needed")

    # Model: Use gpt-oss:20b or configured model
    model = os.getenv("OPENAI_MODEL", "gpt-oss:20b")

    return openai.OpenAI(base_url=base, api_key=key), model


PROMPT = """You analyze nightly web QA + SEO results.

**Current KPIs:**
{kpistr}

**Trends (z >= 2.0 flagged as anomalies):**
{trendstr}

**Recent Context (RAG):**
{context}

**Task:**
1) Explain any KPI changes (concise, technical).
2) Identify likely root causes (specific pages/tests/components).
3) Propose next actions (bullet list), preferring low-risk fixes.

Return concise Markdown with headings and bullets. Avoid PII. Focus on actionable insights."""


def generate_insight(kpis: dict, trend, retriever) -> str:
    """
    Generate AI insight from KPIs and trends using RAG context.

    Args:
        kpis: Current KPI dictionary
        trend: Trend object with anomalies
        retriever: Function to retrieve RAG context (query, k) -> list[dict]

    Returns:
        Markdown formatted insight text
    """
    # Build query for RAG context
    query = "Why did metrics change? Summarize related context from the last week."

    try:
        ctx = retriever(query, k=6)
        ctx_text = "\n".join(f"- {c['date']}: {c['text']}" for c in ctx) if ctx else "N/A"
    except Exception as e:
        ctx_text = f"(RAG context unavailable: {e})"

    # Format KPIs
    kpistr = "\n".join(f"- **{k}**: {v}" for k, v in kpis.items())

    # Format trends
    if hasattr(trend, "anomalies") and trend.anomalies:
        trendstr = "\n".join(
            f"- **{a['field']}**: z={a['z']} (value {a['value']} vs μ={a['mean']}, σ={a['std']}) on {a['date']}"
            for a in trend.anomalies
        )
    else:
        trendstr = "No significant anomalies detected."

    # Build prompt
    content = PROMPT.format(kpistr=kpistr, trendstr=trendstr, context=ctx_text)

    try:
        client, model = _client()

        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": content}],
            temperature=0.2,
        )

        return resp.choices[0].message.content.strip()

    except Exception as e:
        # Fallback if LLM unavailable
        return f"""## Insight Generation Failed

**Error:** {e}

**Summary:**
- SEO Coverage: {kpis.get('seo_coverage_pct', 'N/A')}%
- Playwright Pass Rate: {kpis.get('playwright_pass_pct', 'N/A')}%
- Average P95: {kpis.get('avg_p95_ms', 'N/A')}ms
- Autofix Changes: {kpis.get('autofix_delta_count', 'N/A')}

{trendstr}

**Recommendation:** Review metrics manually and ensure Ollama service is running.
"""
