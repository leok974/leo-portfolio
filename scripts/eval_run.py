import os, json, time, sys, argparse, pathlib, datetime
try:
    import httpx
except ImportError:
    print("Please install httpx in your venv: pip install httpx", file=sys.stderr); sys.exit(2)

def post_json(url, data, timeout=60):
    with httpx.Client(timeout=timeout) as c:
        r = c.post(url, json=data)
        r.raise_for_status()
        return r.json()

def get_json(url, timeout=30):
    with httpx.Client(timeout=timeout) as c:
        r = c.get(url)
        r.raise_for_status()
        return r.json()

def load_jsonl(p: str):
    rows = []
    with open(p, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            rows.append(json.loads(line))
    return rows

def run_case_chat(base, row):
    q = row["question"]
    body = {"messages":[{"role":"user","content":q}], "include_sources": True}
    t0 = time.time()
    res = post_json(f"{base}/chat", body, timeout=120)
    dt = (time.time() - t0) * 1000.0

    content = (res.get("content") or "")[:10000]
    sources = res.get("sources") or []
    grounded = bool(res.get("grounded"))
    backends = res.get("backends") or {}
    gen_b = (backends.get("gen") or {}).get("last_backend")
    scope = res.get("scope") or {}
    route = scope.get("route")

    errors = []
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

def run_case_plan(base, row):
    q = row["question"]
    t0 = time.time()
    res = post_json(f"{base}/api/plan", {"question": q}, timeout=60)
    dt = (time.time() - t0) * 1000.0
    plan = (res or {}).get("plan") or {}
    steps = plan.get("plan") or []

    errors = []
    exp_tool = row.get("expect_tool")
    if exp_tool and not any((s.get("tool") == exp_tool) for s in steps):
        errors.append(f'expected tool "{exp_tool}" not in plan')
    exp_first = row.get("expect_first_tool")
    if exp_first and (steps[0].get("tool") if steps else None) != exp_first:
        errors.append(f'expected first step "{exp_first}", got "{(steps[0].get("tool") if steps else None)}"')
    exp_args_contains = row.get("expect_args_contains") or []
    if exp_args_contains and steps:
        args_str = json.dumps(steps[0].get("args") or {})
        for needle in exp_args_contains:
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

def run_file(base, file_path):
    rows = load_jsonl(file_path)
    results = []
    for row in rows:
        kind = row.get("type") or "chat"
        if kind == "plan":
            results.append(run_case_plan(base, row))
        else:
            results.append(run_case_chat(base, row))
    return results

def append_history(history_path, payload):
    history_path.parent.mkdir(parents=True, exist_ok=True)
    with history_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.getenv("EVAL_BASE", "http://127.0.0.1:8023"))
    ap.add_argument("--file", action="append", default=["evals/baseline.jsonl"])
    ap.add_argument("--fail-under", type=float, default=1.0, help="min pass ratio (0..1)")
    ap.add_argument("--history", action="store_true", help="append to data/eval_history.jsonl")
    ap.add_argument("--history-path", default="data/eval_history.jsonl")
    args = ap.parse_args()

    # readiness
    try:
        ready = get_json(f"{args.base}/api/ready")
        if not ready.get("ok"):
            print("Backend not ready.", file=sys.stderr); sys.exit(2)
    except Exception as e:
        print(f"Ready check failed: {e}", file=sys.stderr); sys.exit(2)

    all_results = []
    for fp in args.file:
        all_results.extend(run_file(args.base, fp))

    passed = sum(1 for r in all_results if r["ok"])
    total = len(all_results)
    ratio = (passed / total) if total else 0.0

    summary = {
        "ok": ratio >= args.fail_under,
        "pass": passed, "total": total, "ratio": round(ratio, 3),
        "ts": datetime.datetime.utcnow().isoformat() + "Z",
        "files": args.file,
        "results": all_results,
        "base": args.base,
    }

    # try to include metrics + git snippet
    try:
        summary["metrics"] = get_json(f"{args.base}/api/metrics")
    except Exception:
        pass
    try:
        import subprocess
        branch = subprocess.check_output(["git","rev-parse","--abbrev-ref","HEAD"], text=True).strip()
        commit = subprocess.check_output(["git","rev-parse","--short","HEAD"], text=True).strip()
        summary["git"] = {"branch": branch, "commit": commit}
    except Exception:
        pass

    print(json.dumps(summary, indent=2))
    if args.history:
        append_history(pathlib.Path(args.history_path), summary)

    if ratio < args.fail_under:
        sys.exit(1)

if __name__ == "__main__":
    main()
