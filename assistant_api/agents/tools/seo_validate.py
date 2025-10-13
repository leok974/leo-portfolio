"""SEO validation tool: runs guardrails + lighthouse, merges reports."""

import json
import os
import pathlib
import shlex
import subprocess
import time
from typing import Any, Dict, List, Optional, Tuple

from ...settings import settings


class StepResult(dict[str, Any]):
    """Typed dict for step results."""

    pass


def _run_cmd(cmd: str, cwd: str | None, timeout: int) -> tuple[int, str, str, float]:
    """Run a shell command with timeout, return (rc, stdout, stderr, duration)."""
    t0 = time.time()
    proc = subprocess.Popen(
        shlex.split(cmd),
        cwd=cwd or os.getcwd(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        out, err = proc.communicate()
        return (124, out, err or "timeout"), time.time() - t0
    return (proc.returncode, out, err, time.time() - t0)


def _safe_json_parse(s: str) -> Any:
    """Parse JSON safely, return unparsed string on failure."""
    try:
        return json.loads(s)
    except Exception:
        return {"_unparsed": s[:2000]}


def run_guardrails(pages_hint: str | None = None) -> StepResult:
    """Run SEO guardrails script, return structured result."""
    cmd = settings.SEO_GUARDRAILS_CMD
    if pages_hint and " --pages " not in cmd and " --sitemap " not in cmd:
        # Allow passing a pages hint to your script (no-op if script ignores it)
        cmd = f"{cmd} --pages {shlex.quote(pages_hint)}"

    rc, out, err, dur = _run_cmd(
        cmd, cwd=None, timeout=settings.SEO_VALIDATE_TIMEOUT_SECS
    )
    if rc != 0:
        return StepResult(
            ok=False,
            step="guardrails",
            rc=rc,
            duration_sec=dur,
            stderr=err,
            note="guardrails failed",
        )
    data = _safe_json_parse(out)
    return StepResult(ok=True, step="guardrails", rc=rc, duration_sec=dur, report=data)


def run_lighthouse_batch(pages_hint: str | None = None) -> StepResult:
    """Run Lighthouse batch script, return structured result."""
    cmd = settings.LIGHTHOUSE_BATCH_CMD
    if pages_hint and " --pages " not in cmd and " --sitemap " not in cmd:
        # Same trick: try to pass the hint if your script supports it
        if pages_hint.startswith("sitemap://"):
            # convention: your script may accept --sitemap file
            # leave as-is; batch script already defaults to sitemap.xml
            pass
        else:
            cmd = f"{cmd} --pages {shlex.quote(pages_hint)}"

    rc, out, err, dur = _run_cmd(
        cmd, cwd=None, timeout=settings.SEO_VALIDATE_TIMEOUT_SECS
    )
    if rc != 0:
        return StepResult(
            ok=False,
            step="lighthouse",
            rc=rc,
            duration_sec=dur,
            stderr=err,
            note="lighthouse failed",
        )
    data = _safe_json_parse(out)
    return StepResult(ok=True, step="lighthouse", rc=rc, duration_sec=dur, report=data)


def seo_validate_to_artifacts(
    artifact_dir: pathlib.Path, pages_hint: str | None = None
) -> dict[str, Any]:
    """
    Runs both guardrails + lighthouse, writes:
      - guardrails.json
      - lighthouse.json
      - report.json (merged summary)
    Returns a summary dict used by the agent runner.
    """
    artifact_dir.mkdir(parents=True, exist_ok=True)
    steps: list[StepResult] = []

    # --- Guardrails ---
    try:
        g = run_guardrails(pages_hint)
    except FileNotFoundError as e:
        g = StepResult(
            ok=False,
            step="guardrails",
            rc=127,
            duration_sec=0.0,
            stderr=str(e),
            note="script not found",
            skipped=True,
        )
    steps.append(g)

    # --- Lighthouse ---
    try:
        lh = run_lighthouse_batch(pages_hint)
    except FileNotFoundError as e:
        lh = StepResult(
            ok=False,
            step="lighthouse",
            rc=127,
            duration_sec=0.0,
            stderr=str(e),
            note="script not found",
            skipped=True,
        )
    steps.append(lh)

    # Write raw step files if present
    if steps[0].get("report") is not None:
        (artifact_dir / "guardrails.json").write_text(
            json.dumps(steps[0]["report"], indent=2), encoding="utf-8"
        )
    if steps[1].get("report") is not None:
        (artifact_dir / "lighthouse.json").write_text(
            json.dumps(steps[1]["report"], indent=2), encoding="utf-8"
        )

    # Merge a shallow overview:
    overview: dict[str, Any] = {
        "inputs": {"pages": pages_hint or "sitemap://current"},
        "steps": [
            {
                "step": s.get("step"),
                "ok": s.get("ok", False),
                "rc": s.get("rc"),
                "duration_sec": s.get("duration_sec"),
                "skipped": s.get("skipped", False),
                "note": s.get("note"),
                # keep only the most relevant fields from big reports to keep this summary light
                "report_summary": _extract_summary(s.get("report")),
            }
            for s in steps
        ],
    }
    (artifact_dir / "report.json").write_text(
        json.dumps(overview, indent=2), encoding="utf-8"
    )

    # "Outputs" for the agent task
    ok = all(s.get("ok") or s.get("skipped") for s in steps)
    skipped = all(s.get("skipped") for s in steps)

    return {
        "ok": ok,
        "pages": pages_hint or "sitemap://current",
        "artifacts": {
            "report_json": str((artifact_dir / "report.json").resolve()),
            "guardrails_json": (
                str((artifact_dir / "guardrails.json").resolve())
                if steps[0].get("report")
                else None
            ),
            "lighthouse_json": (
                str((artifact_dir / "lighthouse.json").resolve())
                if steps[1].get("report")
                else None
            ),
        },
        "skipped_all": skipped,
        "step_status": [
            {
                "step": s.get("step"),
                "ok": s.get("ok"),
                "rc": s.get("rc"),
                "skipped": s.get("skipped", False),
            }
            for s in steps
        ],
    }


def _extract_summary(report: Any) -> Any:
    """
    Attempt to extract a small summary from potentially large reports.
    You can adjust this per your JSON shape.
    """
    if isinstance(report, dict):
        # Lighthouse-like summary
        scores = {}
        if "categories" in report and isinstance(report["categories"], dict):
            for k, v in report["categories"].items():
                sc = v.get("score")
                if sc is not None:
                    scores[k] = sc
        # Guardrails-like counts
        issues = None
        if "issues" in report and isinstance(report["issues"], list):
            issues = len(report["issues"])
        return {"scores": scores or None, "issue_count": issues}
    if isinstance(report, list):
        # Many-page batch — just count entries
        return {"entries": len(report)}
    return None
