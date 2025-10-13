"""Code review tool - executes static analysis on diffs."""

import json
import pathlib
import shlex
import subprocess
import time
from typing import Any, Dict, Tuple

from ...settings import settings


def _run(cmd: str, timeout: int) -> tuple[int, str, str, float]:
    """Execute command with timeout, return (rc, stdout, stderr, duration)."""
    t0 = time.time()
    try:
        p = subprocess.Popen(
            shlex.split(cmd), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        out, err = p.communicate(timeout=timeout)
        return p.returncode, out, err, time.time() - t0
    except FileNotFoundError as e:
        return 127, "", str(e), time.time() - t0
    except subprocess.TimeoutExpired:
        p.kill()
        return 124, "", "timeout", time.time() - t0


def run_code_review(artifact_dir: pathlib.Path) -> dict[str, Any]:
    """
    Run code review command and write artifacts.

    Returns summary dict with:
    - ok: bool (True if passed or skipped)
    - skipped: bool (True if command not found)
    - rc: int (return code)
    - duration_sec: float
    - artifacts: dict with report_json path
    """
    artifact_dir.mkdir(parents=True, exist_ok=True)

    rc, out, err, dur = _run(
        settings.CODE_REVIEW_CMD, settings.CODE_REVIEW_TIMEOUT_SECS
    )
    skipped = rc == 127

    # Try to parse JSON output
    report = None
    try:
        report = json.loads(out) if out else None
    except json.JSONDecodeError:
        report = {"_unparsed": out[:2000]}

    # Write raw report artifact
    (artifact_dir / "code_review.json").write_text(
        json.dumps(report or {}, indent=2), encoding="utf-8"
    )

    # Create summary
    summary = {
        "ok": (rc == 0) or skipped,
        "skipped": skipped,
        "rc": rc,
        "duration_sec": dur,
        "artifacts": {
            "report_json": str((artifact_dir / "report.json").resolve()),
            "code_review_json": str((artifact_dir / "code_review.json").resolve()),
        },
    }

    # Write summary as report.json (this is what runner will point outputs_uri to)
    (artifact_dir / "report.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    return summary
