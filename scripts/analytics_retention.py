"""
Compress (gzip) and prune analytics event logs.

Rules:
 - Files named events-YYYYMMDD.jsonl older than ANALYTICS_GZIP_AFTER_DAYS are gzipped to .jsonl.gz
 - Files (jsonl or jsonl.gz) older than ANALYTICS_RETENTION_DAYS are deleted
 - weights.json is left untouched
"""
from __future__ import annotations

from assistant_api.settings import get_settings
from assistant_api.services.retention import run_retention

def main() -> int:
    s = get_settings()
    stats = run_retention(s)
    print(
        f"[retention] scanned={stats['scanned']} compressed={stats['compressed']} "
        f"removed={stats['removed']} dir={stats['dir']}"
    )
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
