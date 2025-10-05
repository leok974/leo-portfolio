from __future__ import annotations
import json, time, datetime
from typing import Any, Dict, List
import httpx

def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"

async def _chat_case(base: str, row: Dict[str, Any]) -> Dict[str, Any]:
    q = row["question"]
    body = {"messages":[{"role":"user","content":q}], "include_sources": True}
    t0 = time.time()
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(f"{base}/chat", json=body)
        r.raise_for_status()
        res = r.json()
    dt = (time.time() - t0) * 1000.0

    content = (res.get("content") or "")[:10000]
    sources = res.get("sources") or []
    grounded = bool(res.get("grounded"))
    backends = res.get("backends") or {}
    gen_b = (backends.get("gen") or {}).get("last_backend")
    scope = res.get("scope") or {}
    route = scope.get("route")

    errors: List[str] = []
    for s in (row.get("expect_contains") or []):
        if s.lower() not in content.lower():
            errors.append(f'missing expected text: "{s}"')
    ms = int(row.get("min_sources") or 0)
    if ms and len(sources) < ms:
        errors.append(f"expected >={ms} sources, got {len(sources)}")
    exp_route = row.get("route")
    if exp_route and route != exp_route:
        errors.append(f"route mismatch: expected {exp_route}, got {route}")

    return {
        "id": row.get("id"),
        "type": "chat",
        "ok": (len(errors) == 0),
        "latency_ms": round(dt, 1),
        "grounded": grounded,
        "sources": len(sources),
        "gen_backend": gen_b,
        "errors": errors,
    }

async def _plan_case(base: str, row: Dict[str, Any]) -> Dict[str, Any]:
    q = row["question"]
    t0 = time.time()
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{base}/api/plan", json={"question": q})
        r.raise_for_status()
        res = r.json()
    dt = (time.time() - t0) * 1000.0
    plan = (res or {}).get("plan") or {}
    steps = plan.get("plan") or []

    errors: List[str] = []
    exp_tool = row.get("expect_tool")
    if exp_tool and not any((s.get("tool") == exp_tool) for s in steps):
        errors.append(f'expected tool "{exp_tool}" not in plan')
    exp_first = row.get("expect_first_tool")
    if exp_first and (steps[0].get("tool") if steps else None) != exp_first:
        errors.append(f'expected first step "{exp_first}", got "{(steps[0].get("tool") if steps else None)}"')
    for needle in (row.get("expect_args_contains") or []):
        args_str = json.dumps(steps[0].get("args") or {}) if steps else "{}"
        if needle not in args_str:
            errors.append(f'expected args to contain "{needle}"')

    return {
        "id": row.get("id"),
        "type": "plan",
        "ok": (len(errors) == 0),
        "latency_ms": round(dt, 1),
        "steps": len(steps),
        "errors": errors,
    }

def _load_jsonl(path: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            rows.append(json.loads(line))
    return rows

async def run_eval_inprocess(
    base: str,
    files: List[str],
    fail_under: float,
    metrics: Dict[str, Any] | None = None,
    git: Dict[str, str] | None = None,
) -> Dict[str, Any]:
    results: List[Dict[str, Any]] = []
    for fp in files:
        for row in _load_jsonl(fp):
            kind = (row.get("type") or "chat").lower()
            if kind == "plan":
                results.append(await _plan_case(base, row))
            else:
                results.append(await _chat_case(base, row))

    passed = sum(1 for r in results if r["ok"])
    total = len(results)
    ratio = (passed / total) if total else 0.0
    return {
        "ok": ratio >= fail_under,
        "pass": passed, "total": total, "ratio": round(ratio, 3),
        "ts": _now_iso(),
        "files": files,
        "results": results,
        "base": base,
        "metrics": metrics or {},
        "git": git or {},
    }
