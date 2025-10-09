"""
Nightly data loader - merges JSON reports from multiple sources.

Phase 51.0 — Analytics Loop
"""
from __future__ import annotations
import json
from pathlib import Path
from datetime import date

REPORT_DIRS = [
    Path("reports"),
    Path("reports/playwright"),
    Path("reports/seo"),
    Path("reports/prometheus"),
]


def _read_jsons(paths: list[Path]) -> list[dict]:
    """Read JSON and JSONL files safely."""
    out = []
    for p in paths:
        try:
            if p.is_file() and p.suffix in {".json", ".jsonl"}:
                if p.suffix == ".jsonl":
                    lines = p.read_text(encoding="utf-8").splitlines()
                    out.extend(json.loads(line) for line in lines if line.strip())
                else:
                    content = p.read_text(encoding="utf-8") or "{}"
                    out.append(json.loads(content))
        except Exception as e:
            out.append({"_read_error": str(e), "_file": str(p)})
    return out


def load_nightly(d: date) -> dict:
    """
    Load and merge nightly reports for a specific date.

    Args:
        d: The date to load reports for

    Returns:
        Merged dictionary with SEO, Playwright, autofix, and Prometheus data
    """
    # Find date-specific files
    candidates = []
    for base in REPORT_DIRS:
        if not base.exists():
            continue
        # Look for files containing the date
        candidates += list(base.glob(f"*{d.isoformat()}*.json*"))

    # Fallback: latest files if day-specific not present
    if not candidates:
        for base in REPORT_DIRS:
            if not base.exists():
                continue
            all_files = sorted(base.glob("*.json*"), key=lambda p: p.stat().st_mtime)
            candidates += all_files[-5:]  # Last 5 files from each dir

    # Build merged structure
    merged = {
        "date": d.isoformat(),
        "seo": {},
        "playwright": {},
        "autofix": {},
        "prometheus": {},
        "_sources": [str(p) for p in candidates],
    }

    # Parse and bucket by content hints
    blobs = _read_jsons(candidates)
    for blob in blobs:
        # SEO reports
        if "seo_coverage" in blob or "pages" in blob or "totals" in blob:
            merged["seo"].update(blob)
        # Playwright reports
        elif "tests" in blob or "pass_rate" in blob or "suites" in blob:
            merged["playwright"].update(blob)
        # Autofix reports
        elif "autofix" in blob or "fixes" in blob or "changed" in blob:
            merged["autofix"].update(blob)
        # Prometheus metrics
        elif "metrics" in blob or "scrape" in blob or "p95_ms" in blob:
            merged["prometheus"].update(blob)

    # Persist to data/nightly/
    out_dir = Path("data/nightly")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{d.isoformat()}.json"
    out_path.write_text(json.dumps(merged, indent=2), encoding="utf-8")

    return merged
