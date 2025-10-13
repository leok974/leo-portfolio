from __future__ import annotations

import datetime as _dt
import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field

router = APIRouter()

FEEDBACK_PATH = Path("data/feedback.jsonl")


class FeedbackIn(BaseModel):
    question: str = ""
    answer: str = ""
    score: int = Field(0, description="+1 for thumbs up, -1 for thumbs down")
    note: str | None = None
    served_by: str | None = None
    grounded: bool | None = None
    sources_count: int | None = None
    scope: dict | None = None
    route: str | None = None


def _append_jsonl(path: Path, obj: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


@router.post("/api/feedback")
async def post_feedback(item: FeedbackIn):
    ts = _dt.datetime.utcnow().replace(tzinfo=_dt.UTC).isoformat()
    rec = item.model_dump()
    rec["ts"] = ts
    try:
        _append_jsonl(FEEDBACK_PATH, rec)
        return {"ok": True, "ts": ts}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/api/feedback/recent")
async def get_feedback_recent(limit: int = 50):
    items: list[dict[str, Any]] = []
    if FEEDBACK_PATH.exists():
        try:
            with FEEDBACK_PATH.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        items.append(json.loads(line))
                    except Exception:
                        continue
        except Exception:
            items = []
    items = list(reversed(items[-limit:]))
    # Compute a minimal summary
    summary = {
        "count": len(items),
        "up": sum(1 for x in items if int(x.get("score", 0) or 0) > 0),
        "down": sum(1 for x in items if int(x.get("score", 0) or 0) < 0),
    }
    return {"ok": True, "items": items, "summary": summary}


@router.get("/api/feedback/export.csv")
async def get_feedback_csv():
    headers = [
        "ts",
        "score",
        "served_by",
        "grounded",
        "sources_count",
        "question",
        "answer",
        "note",
    ]
    lines = [",".join(headers)]
    if FEEDBACK_PATH.exists():
        try:
            with FEEDBACK_PATH.open("r", encoding="utf-8") as f:
                for raw in f:
                    raw = raw.strip()
                    if not raw:
                        continue
                    try:
                        rec = json.loads(raw)
                    except Exception:
                        continue
                    row = [
                        str(rec.get("ts", "")),
                        str(rec.get("score", "")),
                        str(rec.get("served_by", "")),
                        str(rec.get("grounded", "")),
                        str(rec.get("sources_count", "")),
                        json.dumps(rec.get("question", ""), ensure_ascii=False),
                        json.dumps(rec.get("answer", ""), ensure_ascii=False),
                        json.dumps(rec.get("note", ""), ensure_ascii=False),
                    ]
                    lines.append(",".join(row))
        except Exception:
            pass
    csv = "\n".join(lines) + "\n"
    return Response(
        content=csv,
        media_type="text/csv; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )
