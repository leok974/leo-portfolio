from __future__ import annotations

import gzip
import re
from datetime import UTC, date, datetime, timezone
from pathlib import Path
from typing import Any, Dict

from .analytics_store import AnalyticsStore

PATTERN = re.compile(r"^events-(\d{8})\.jsonl(\.gz)?$")

def _parse_day(p: Path) -> date | None:
    m = PATTERN.match(p.name)
    if not m:
        return None
    ymd = m.group(1)
    try:
        return datetime.strptime(ymd, "%Y%m%d").date()
    except Exception:
        return None

def _gzip_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    with src.open("rb") as f_in, gzip.open(dst, "wb") as f_out:
        while True:
            chunk = f_in.read(1024 * 1024)
            if not chunk:
                break
            f_out.write(chunk)

def run_retention(settings: dict[str, Any]) -> dict[str, Any]:
    """
    Compress (gzip) and prune analytics event logs under settings['ANALYTICS_DIR'].
    Returns stats dict: scanned, compressed, removed, dir.
    """
    store = AnalyticsStore(settings["ANALYTICS_DIR"])
    base = store.dir
    base.mkdir(parents=True, exist_ok=True)
    today = datetime.now(UTC).date()

    gzip_after = max(0, int(settings["ANALYTICS_GZIP_AFTER_DAYS"]))
    retain = max(gzip_after + 1, int(settings["ANALYTICS_RETENTION_DAYS"]))

    compressed = 0
    removed = 0
    scanned = 0

    for p in sorted(base.iterdir()):
        if not p.is_file():
            continue
        if p.name == "weights.json":
            continue
        m = PATTERN.match(p.name)
        if not m:
            continue
        scanned += 1
        day = _parse_day(p)
        if not day:
            continue
        age = (today - day).days

        # prune
        if age > retain:
            p.unlink(missing_ok=True)
            removed += 1
            continue

        # compress raw jsonl after threshold
        if p.suffixes == [".jsonl"] and age >= gzip_after:
            gz = p.with_suffix(p.suffix + ".gz")  # .jsonl.gz
            if not gz.exists():
                _gzip_file(p, gz)
            p.unlink(missing_ok=True)
            compressed += 1

    return {
        "scanned": scanned,
        "compressed": compressed,
        "removed": removed,
        "dir": str(base),
    }
