"""
KPI extractor - extracts key performance indicators from merged nightly data.

Phase 51.0 — Analytics Loop
"""
from __future__ import annotations
import statistics as stats


def _safe_float(v, default=0.0):
    """Safely convert value to float."""
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def extract_kpis(merged: dict) -> dict:
    """
    Extract KPIs from merged nightly data.

    Args:
        merged: Merged nightly data dictionary

    Returns:
        Dictionary of KPI metrics
    """
    seo = merged.get("seo", {})
    pw = merged.get("playwright", {})
    auto = merged.get("autofix", {})
    prom = merged.get("prometheus", {})

    # SEO coverage percentage
    seo_pages = seo.get("pages", [])
    seo_totals = seo.get("totals", {})

    if seo_totals:
        # Use totals if available
        seo_ok = seo_totals.get("passed", 0)
        seo_total = seo_totals.get("total", 1)
    else:
        # Calculate from pages
        seo_ok = sum(1 for p in seo_pages if p.get("ok") or p.get("status") == "passed")
        seo_total = max(1, len(seo_pages))

    seo_cov = round(100.0 * seo_ok / seo_total, 2)

    # Playwright pass rate
    pw_tests = pw.get("tests", [])
    pw_totals = pw.get("totals", {})

    if pw_totals:
        pw_passed = pw_totals.get("passed", 0)
        pw_total = pw_totals.get("total", 1)
    else:
        pw_passed = sum(1 for t in pw_tests if t.get("status") == "passed")
        pw_total = max(1, len(pw_tests))

    pass_rate = round(100.0 * pw_passed / pw_total, 2)

    # Average P95 latency from Prometheus
    prom_metrics = prom.get("metrics", [])
    latencies = []
    for m in prom_metrics:
        if isinstance(m, dict) and m.get("p95_ms") is not None:
            latencies.append(_safe_float(m["p95_ms"]))

    avg_p95 = round(stats.mean(latencies), 2) if latencies else None

    # Autofix delta count
    autofix_fixes = auto.get("fixes", [])
    autofix_changed = auto.get("changed", 0)
    autofix_diff_count = auto.get("diff_count", 0)

    autofix_delta = len(autofix_fixes) or autofix_changed or autofix_diff_count

    return {
        "seo_coverage_pct": seo_cov,
        "playwright_pass_pct": pass_rate,
        "avg_p95_ms": avg_p95,
        "autofix_delta_count": autofix_delta,
    }
