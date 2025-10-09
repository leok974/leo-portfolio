"""
Report builder - generates Markdown reports from KPIs, trends, and insights.

Phase 51.0 — Analytics Loop
"""
from __future__ import annotations
from pathlib import Path
from datetime import datetime, timezone

MD_TEMPLATE = """# Nightly Analytics — {date}

*Generated at {timestamp} UTC*

## 📊 KPIs

{kpitable}

## 📈 Trends

{trend_section}

## 🧠 AI Insight

{insight}

---
*Phase 51.0 — Analytics Loop / RAG Insights*
"""


def write_markdown_report(path: Path, kpis: dict, trend, insight_md: str):
    """
    Write a formatted Markdown report.

    Args:
        path: Output file path
        kpis: KPI dictionary
        trend: Trend object
        insight_md: Generated insight markdown
    """
    # Extract date from trend series
    if hasattr(trend, "series") and trend.series:
        date = trend.series[-1].get("date", "N/A")
    else:
        date = "N/A"

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # Format KPIs as table
    kpitable = "\n".join(
        f"- **{_format_field_name(k)}**: `{v}`"
        for k, v in kpis.items()
    )

    # Format trends
    if hasattr(trend, "anomalies") and trend.anomalies:
        trend_lines = []
        for a in trend.anomalies:
            field_name = _format_field_name(a['field'])
            z_emoji = "🔴" if abs(a['z']) >= 3.0 else "🟡"
            trend_lines.append(
                f"- {z_emoji} **{field_name}**: z={a['z']} "
                f"(value `{a['value']}` vs μ=`{a['mean']}`, σ=`{a['std']}`) "
                f"on `{a['date']}`"
            )
        trend_section = "\n".join(trend_lines)
    else:
        trend_section = "✅ No significant anomalies detected (all metrics within 2σ)."

    # Build final report
    md = MD_TEMPLATE.format(
        date=date,
        timestamp=timestamp,
        kpitable=kpitable,
        trend_section=trend_section,
        insight=insight_md,
    )

    # Write to file
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(md, encoding="utf-8")


def _format_field_name(field: str) -> str:
    """Format field name for display."""
    replacements = {
        "seo_coverage_pct": "SEO Coverage %",
        "playwright_pass_pct": "Playwright Pass Rate %",
        "avg_p95_ms": "Avg P95 Latency (ms)",
        "autofix_delta_count": "Autofix Changes",
    }
    return replacements.get(field, field.replace("_", " ").title())
