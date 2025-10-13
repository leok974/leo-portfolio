from __future__ import annotations

import os
import subprocess
import time
from typing import Any, Dict, List

from .base import BASE_DIR, ToolSpec, persist_audit, register


def _run(argv: list[str], timeout: int = 8) -> str:
    p = subprocess.run(
        argv,
        cwd=str(BASE_DIR),
        capture_output=True,
        text=True,
        timeout=timeout,
        env={**os.environ, "GIT_PAGER": "cat"},
    )
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip() or f"git failed: {argv}")
    return (p.stdout or "").strip()


def _parse_porcelain(s: str):
    # https://git-scm.com/docs/git-status#_porcelain_format_version_1
    modified = added = deleted = renamed = untracked = 0
    sample: list[str] = []
    for line in s.splitlines():
        line = line.rstrip("\n")
        if not line:
            continue
        sample.append(line)
        code = line[:2]
        if line.startswith("??"):
            untracked += 1
        else:
            X, Y = code[0], code[1]
            if X == "R" or Y == "R":
                renamed += 1
            if X == "D" or Y == "D":
                deleted += 1
            if X == "A" or Y == "A":
                added += 1
            if X == "M" or Y == "M":
                modified += 1
    return {
        "modified": modified,
        "added": added,
        "deleted": deleted,
        "renamed": renamed,
        "untracked": untracked,
        "status_sample": sample[:20],
    }


def run_git_status(args: dict[str, Any]) -> dict[str, Any]:
    base_remote = (args.get("base") or os.getenv("GIT_BASE") or "origin/main").strip()
    start = time.time()
    try:
        branch = _run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    except Exception as e:
        return {"ok": False, "error": f"not a git repo or git missing: {e}"}

    last = {"hash": "", "title": "", "when": ""}
    try:
        last_out = _run(["git", "log", "-1", "--pretty=%h|%s|%cr"])
        parts = last_out.split("|", 2)
        if len(parts) == 3:
            last = {"hash": parts[0], "title": parts[1], "when": parts[2]}
    except Exception:
        pass

    dirty = {}
    try:
        por = _run(["git", "status", "--porcelain=v1"])
        dirty = _parse_porcelain(por)
    except Exception:
        dirty = {
            "modified": 0,
            "added": 0,
            "deleted": 0,
            "renamed": 0,
            "untracked": 0,
            "status_sample": [],
        }

    ahead_behind = {"ahead": 0, "behind": 0, "base": base_remote}
    try:
        # origin/main...HEAD => "<behind> <ahead>" with --left-right --count (left is base)
        ab = _run(
            ["git", "rev-list", "--left-right", "--count", f"{base_remote}...HEAD"]
        )
        left, right = ab.split()
        ahead_behind = {"ahead": int(right), "behind": int(left), "base": base_remote}
    except Exception:
        pass

    dt_ms = int((time.time() - start) * 1000)
    out = {
        "ok": True,
        "branch": branch,
        "dirty": dirty,
        "ahead_behind": ahead_behind,
        "last_commit": last,
        "duration_ms": dt_ms,
    }
    persist_audit(
        {
            "tool": "git_status",
            "branch": branch,
            "dirty": dirty,
            "ahead_behind": ahead_behind,
        }
    )
    return out


register(
    ToolSpec(
        name="git_status",
        desc="Read-only summary of the repository: branch, dirty files, ahead/behind vs base (default origin/main), last commit.",
        schema={
            "type": "object",
            "properties": {
                "base": {
                    "type": "string",
                    "description": "Compare base, e.g. origin/main",
                }
            },
        },
        run=run_git_status,
        dangerous=False,
    )
)
