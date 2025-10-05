import json, os, subprocess, sys, pathlib


def test_eval_planner_cases(tmp_path):
    base = os.getenv("EVAL_BASE", "http://127.0.0.1:8023")
    python = sys.executable
    repo = pathlib.Path(__file__).resolve().parents[1]
    script = repo / "scripts" / "eval_run.py"
    data = repo / "evals" / "tool_planning.jsonl"
    # Require server to be running; skip gently if not.
    try:
        out = subprocess.check_output([python, str(script), "--base", base, "--file", str(data), "--fail-under", "0.67"], stderr=subprocess.STDOUT, timeout=180)
    except subprocess.CalledProcessError as e:
        # If server unavailable, show helpful hint.
        if b"Ready check failed" in e.output or b"Backend not ready" in e.output:
            import pytest; pytest.skip("Backend not running for eval. Start server first.")
        raise
    payload = json.loads(out.decode("utf-8"))
    assert payload["ok"] is True, f"Eval failed: {json.dumps(payload, indent=2)}"
