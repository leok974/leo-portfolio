"""
Reads last 14 days of analytics JSONL from ./data/analytics,
computes section weights, writes weights.json (idempotent).
"""
import json
from pathlib import Path
from datetime import datetime, timedelta, UTC
import sys
import os

# Add parent directory to path to import assistant_api
sys.path.insert(0, str(Path(__file__).parent.parent))

from assistant_api.services.analytics_store import AnalyticsStore
from assistant_api.services.behavior_learning import analyze
from assistant_api.settings import get_settings


def load_events(dir_path: Path):
    files = sorted(dir_path.glob("events-*.jsonl"))[-14:]
    cutoff = datetime.now(UTC) - timedelta(days=14)
    events = []
    for p in files:
        with p.open() as f:
            for line in f:
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                ts = e.get("ts")
                if isinstance(ts, str):
                    try:
                        # tolerate "Z" suffix
                        e["ts"] = datetime.fromisoformat(
                            ts.replace("Z", "+00:00")
                        ).isoformat()
                    except Exception:
                        continue
                events.append(e)
    return events


def main():
    settings = get_settings()
    store = AnalyticsStore(settings["ANALYTICS_DIR"])
    events = load_events(store.dir)
    prev = store.load_weights()
    weights = analyze(
        events,
        prev,
        settings["LAYOUT_SECTIONS_DEFAULT"],
        settings["LEARNING_EMA_ALPHA"],
        settings["LEARNING_DECAY"],
    )
    # Only write if changed to keep commits clean
    before = json.dumps(prev, sort_keys=True)
    after = json.dumps(weights, sort_keys=True)
    if before != after:
        store.save_weights(weights)
        print("weights.json updated:", weights["updated_at"])
        changed = True
    else:
        print("No change in weights.json")
        changed = False
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
