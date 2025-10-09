"""
Trend detector - detects anomalies in KPI time series using z-score analysis.

Phase 51.0 — Analytics Loop
"""
from __future__ import annotations
import json
import math
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any


@dataclass
class Trend:
    """Trend analysis result."""
    window_days: int
    series: list[dict]  # [{date, seo_coverage_pct, ...}]
    anomalies: list[dict]  # [{date, field, z, value, mean, std}]

    def model_dump_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(asdict(self), indent=indent)


def _rolling_stats(values: list[float]) -> tuple[float, float]:
    """Calculate mean and standard deviation."""
    if len(values) < 2:
        return (sum(values) / max(1, len(values)), 0.0)

    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    std = math.sqrt(variance)

    return mean, std


# Fields to monitor for anomalies
FIELDS = ["seo_coverage_pct", "playwright_pass_pct", "avg_p95_ms", "autofix_delta_count"]


def detect_trends(data_dir: Path, window_days: int = 7) -> Trend:
    """
    Detect trends and anomalies across last N days of data.

    Args:
        data_dir: Directory containing nightly JSON files
        window_days: Number of days to analyze

    Returns:
        Trend object with series data and detected anomalies
    """
    files = sorted(data_dir.glob("*.json"))
    series = []

    # Load historical data
    for f in files[-window_days:]:
        try:
            blob = json.loads(f.read_text(encoding="utf-8"))

            # Get KPI data (may be stored directly or need extraction)
            kpi = blob.get("kpi", {})

            # If KPI not pre-computed, extract it
            if not kpi and any(k in blob for k in ["seo", "playwright", "autofix", "prometheus"]):
                from .kpi_extractor import extract_kpis
                kpi = extract_kpis(blob)

            series.append({"date": f.stem, **kpi})
        except Exception as e:
            # Skip malformed files
            series.append({"date": f.stem, "_error": str(e)})

    # Detect anomalies using z-score threshold
    anomalies = []

    for field in FIELDS:
        # Collect valid values for this field
        vals = [s.get(field) for s in series if s.get(field) is not None]

        if len(vals) < 3:
            continue  # Need at least 3 points for meaningful stats

        mean, std = _rolling_stats(vals)

        if std == 0:
            continue  # No variation

        # Check if last value is anomalous (z-score >= 2.0)
        last = vals[-1]
        z = (last - mean) / std

        if abs(z) >= 2.0:
            anomalies.append({
                "date": series[-1]["date"],
                "field": field,
                "value": last,
                "mean": round(mean, 2),
                "std": round(std, 2),
                "z": round(z, 2),
            })

    return Trend(
        window_days=window_days,
        series=series,
        anomalies=anomalies,
    )
