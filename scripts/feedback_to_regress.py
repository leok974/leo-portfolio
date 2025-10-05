#!/usr/bin/env python
"""
Read data/feedback.jsonl and append negative (👎) items into evals/regression.jsonl.
Each case will use the saved question and expect the answer to contain a note to improve later.

Usage:
  python scripts/feedback_to_regress.py

Options via env:
  FEEDBACK_PATH=./data/feedback.jsonl
  REGRESSION_PATH=./evals/regression.jsonl
  LIMIT=100  # max items to append per run
"""
from __future__ import annotations
from pathlib import Path
import json, os, sys, datetime as dt

FEEDBACK_PATH = Path(os.getenv("FEEDBACK_PATH", "data/feedback.jsonl"))
REGRESSION_PATH = Path(os.getenv("REGRESSION_PATH", "evals/regression.jsonl"))
LIMIT = int(os.getenv("LIMIT", "100"))

def load_jsonl(p: Path):
    items = []
    if not p.exists():
        return items
    with p.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                items.append(json.loads(line))
            except Exception:
                continue
    return items

def append_jsonl(p: Path, objs):
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        for o in objs:
            f.write(json.dumps(o, ensure_ascii=False) + "\n")

def main():
    fb = load_jsonl(FEEDBACK_PATH)
    downs = [x for x in fb if int(x.get("score", 0) or 0) < 0]
    if not downs:
        print("No negative feedback found.")
        return 0
    cases = []
    ts = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    for i, x in enumerate(downs[-LIMIT:]):
        q = (x.get("question") or "").strip()
        if not q:
            # fallback to short snippet of answer as a query
            q = (x.get("answer") or "").split("\n")[0][:180]
        case = {
            "id": f"fbreg-{ts}-{i+1}",
            "type": "chat",
            "q": q,
            "expect_contains": ["(improve)"]
        }
        cases.append(case)
    append_jsonl(REGRESSION_PATH, cases)
    print(f"Appended {len(cases)} cases to {REGRESSION_PATH}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
