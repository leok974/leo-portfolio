#!/usr/bin/env python
"""Check agent events in the database."""
import sqlite3
import sys

run_id = sys.argv[1] if len(sys.argv) > 1 else "0714ffc9-439e-4d67-9de7-7be21aa6ce16"
con = sqlite3.connect("/app/data/rag.sqlite")
cur = con.cursor()

print(f"Events for run {run_id}:")
print("-" * 80)
rows = cur.execute(
    "SELECT ts, level, event, data FROM agent_events WHERE run_id=? ORDER BY ts",
    (run_id,)
).fetchall()

for ts, level, event, data in rows:
    print(f"{ts} [{level:5}] {event}: {data}")

if not rows:
    print("No events found for this run_id")
