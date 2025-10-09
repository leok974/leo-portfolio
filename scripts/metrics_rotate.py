#!/usr/bin/env python3
"""
Rotates ./data/metrics.jsonl by date and optional size threshold.
- Writes to metrics-YYYY-MM-DD.jsonl for the current day.
- On day switch or when size exceeds --max-mb, starts a new file.
- Gzips files older than --gzip-after days.
- Prunes files older than --retention days.
- In --loop mode, runs forever with sleep interval.
"""
from __future__ import annotations
import argparse, gzip, os, shutil, sys, time
from datetime import datetime, timedelta
from pathlib import Path

DATA_DIR = Path(os.getenv("METRICS_DIR", "./data")).resolve()
CURRENT = DATA_DIR / "metrics.jsonl"


def day_key(ts: float | None = None) -> str:
    dt = datetime.utcfromtimestamp(ts or time.time())
    return dt.strftime("%Y-%m-%d")


def rotate_if_needed(max_mb: float | None) -> None:
    # Ensure dir exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Ensure current symlink/file points to today's shard
    today = day_key()
    shard = DATA_DIR / f"metrics-{today}.jsonl"

    # If CURRENT exists as file with yesterday content, move it into shard name
    if CURRENT.exists() and not CURRENT.is_symlink():
        if shard.resolve() != CURRENT.resolve():
            # Append then remove current
            with shard.open("a", encoding="utf-8") as dst, CURRENT.open("r", encoding="utf-8") as src:
                shutil.copyfileobj(src, dst)
            CURRENT.unlink()

    # Ensure CURRENT -> shard symlink
    if not CURRENT.exists():
        try:
            CURRENT.symlink_to(shard.name)
        except OSError:
            # Fallback: create an empty file
            shard.touch(exist_ok=True)
            shard.rename(CURRENT)
            return

    # Size rotation
    if max_mb is not None:
        try:
            size_mb = shard.stat().st_size / (1024 * 1024)
            if size_mb >= max_mb:
                # Start a new numbered shard for today
                i = 1
                while True:
                    alt = DATA_DIR / f"metrics-{today}.{i}.jsonl"
                    if not alt.exists():
                        break
                    i += 1
                # Move current shard to alt; recreate symlink to alt
                if CURRENT.is_symlink():
                    CURRENT.unlink()
                shard.rename(alt)
                (DATA_DIR / f"metrics-{today}.jsonl").touch()
                CURRENT.symlink_to(f"metrics-{today}.jsonl")
        except FileNotFoundError:
            pass


def gzip_old(gzip_after_days: int) -> None:
    if gzip_after_days <= 0:
        return
    cutoff = datetime.utcnow() - timedelta(days=gzip_after_days)
    for p in DATA_DIR.glob("metrics-*.jsonl"):
        mtime = datetime.utcfromtimestamp(p.stat().st_mtime)
        if mtime < cutoff:
            gz = p.with_suffix(p.suffix + ".gz")
            if gz.exists():
                continue
            with p.open("rb") as f_in, gzip.open(gz, "wb", compresslevel=6) as f_out:
                shutil.copyfileobj(f_in, f_out)
            p.unlink(missing_ok=True)


def prune_old(retention_days: int) -> None:
    if retention_days <= 0:
        return
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    for p in list(DATA_DIR.glob("metrics-*.jsonl")) + list(DATA_DIR.glob("metrics-*.jsonl.gz")):
        mtime = datetime.utcfromtimestamp(p.stat().st_mtime)
        if mtime < cutoff:
            p.unlink(missing_ok=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-mb", type=float, default=None, help="rotate shard when size >= MB")
    ap.add_argument("--gzip-after", type=int, default=3, help="gzip shards older than N days")
    ap.add_argument("--retention", type=int, default=30, help="delete shards older than N days")
    ap.add_argument("--interval", type=int, default=300, help="loop sleep seconds")
    ap.add_argument("--once", action="store_true", help="run one maintenance pass and exit")
    args = ap.parse_args()

    if args.once:
        rotate_if_needed(args.max_mb)
        gzip_old(args.gzip_after)
        prune_old(args.retention)
        return 0

    while True:
        try:
            rotate_if_needed(args.max_mb)
            gzip_old(args.gzip_after)
            prune_old(args.retention)
        except Exception as e:
            print(f"[rotate] error: {e}", file=sys.stderr)
        time.sleep(args.interval)

if __name__ == "__main__":
    raise SystemExit(main())
