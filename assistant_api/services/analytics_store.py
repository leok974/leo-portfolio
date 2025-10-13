import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Dict, List


class AnalyticsStore:
    def __init__(self, dir_path: str):
        self.dir = Path(dir_path)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.weights_path = self.dir / "weights.json"

    def append_jsonl(self, events: list[dict[str, Any]]):
        fname = self.dir / f"events-{datetime.now(UTC):%Y%m%d}.jsonl"
        with fname.open("a", encoding="utf-8") as f:
            for e in events:
                f.write(json.dumps(e, separators=(",", ":"), default=str) + "\n")

    def load_weights(self) -> dict[str, Any]:
        if self.weights_path.exists():
            return json.loads(self.weights_path.read_text())
        return {"updated_at": None, "sections": {}}

    def save_weights(self, weights: dict[str, Any]):
        self.weights_path.write_text(json.dumps(weights, indent=2))
