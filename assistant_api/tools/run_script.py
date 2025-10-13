from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import time
from typing import Any, Dict, List

from .base import (
    BASE_DIR,
    ToolSpec,
    _safe_join,
    is_allow_tools,
    persist_audit,
    register,
)

# Default allowlist for UI display when ALLOW_SCRIPTS is unset (does not affect enforcement)
DEFAULT_ALLOW = [
    "scripts/rag-build-index.ps1",
]


def _allowed(script_rel: str) -> bool:
    allow = os.getenv("ALLOW_SCRIPTS", "").strip()
    if not allow:
        return False
    parts: list[str] = []
    for sep in (";", ","):
        if sep in allow:
            parts = [p.strip() for p in allow.split(sep)]
            break
    if not parts:
        parts = [allow]
    norm = script_rel.replace("\\", "/").strip()
    return any(norm.lower() == p.replace("\\", "/").strip().lower() for p in parts if p)


def _build_argv(path: pathlib.Path, args: list[str]) -> list[str]:
    s = str(path)
    low = s.lower()
    if low.endswith(".ps1"):
        shell = os.getenv("POWERSHELL_EXE") or "pwsh"
        argv = [shell, "-NoLogo", "-NoProfile"]
        # On Windows hosts, allow bypassing execution policy for repo-local scripts
        if os.name == "nt":
            argv += ["-ExecutionPolicy", "Bypass"]
        argv += ["-File", s]
        return argv + args
    if low.endswith(".sh"):
        sh = os.getenv("BASH_EXE") or "bash"
        return [sh, s] + args
    if low.endswith(".py"):
        py = sys.executable or os.getenv("PYTHON") or "python"
        return [py, s] + args
    return [s] + args


def run_run_script(args: dict[str, Any]) -> dict[str, Any]:
    if not is_allow_tools():
        return {"ok": False, "error": "not allowed (dangerous)"}
    script_rel = (args.get("script") or "").strip()
    if not script_rel:
        return {"ok": False, "error": "missing script"}
    if not _allowed(script_rel):
        return {"ok": False, "error": "script not in allowlist"}
    try:
        path = _safe_join(script_rel)
    except Exception as e:
        return {"ok": False, "error": f"invalid path: {e}"}
    if not path.exists() or not path.is_file():
        return {"ok": False, "error": "script not found"}
    arg_list = args.get("args") or []
    if not isinstance(arg_list, list):
        return {"ok": False, "error": "args must be a list"}
    arg_list = [str(x) for x in arg_list]
    timeout_s = int(args.get("timeout_s") or os.getenv("RUN_SCRIPT_TIMEOUT_S") or 600)
    argv = _build_argv(path, arg_list)
    # Dry-run mode: return the would-be command without executing
    if bool(args.get("dry_run")):
        persist_audit({"tool": "run_script", "script": script_rel, "dry_run": True})
        return {"ok": True, "dry_run": True, "cmd": argv}
    t0 = time.time()
    try:
        p = subprocess.run(
            argv,
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
            timeout=timeout_s,
            env=os.environ.copy(),
        )
        dt = int((time.time() - t0) * 1000)
        out = {
            "ok": True,
            "exit_code": int(p.returncode),
            "duration_ms": dt,
            "stdout_tail": (p.stdout or "")[-4000:],
            "stderr_tail": (p.stderr or "")[-4000:],
        }
        persist_audit(
            {"tool": "run_script", "script": script_rel, "code": p.returncode, "ms": dt}
        )
        return out
    except subprocess.TimeoutExpired:
        dt = int((time.time() - t0) * 1000)
        persist_audit(
            {"tool": "run_script", "script": script_rel, "error": "timeout", "ms": dt}
        )
        return {"ok": False, "error": "timeout"}
    except Exception as e:
        persist_audit({"tool": "run_script", "script": script_rel, "error": str(e)})
        return {"ok": False, "error": str(e)}


register(
    ToolSpec(
        name="run_script",
        desc="Execute an allowed local script with arguments. Requires ALLOW_TOOLS=1 and ALLOW_SCRIPTS allowlist.",
        schema={
            "type": "object",
            "properties": {
                "script": {"type": "string"},
                "args": {"type": "array", "items": {"type": "string"}},
                "timeout_s": {"type": "integer", "minimum": 1},
            },
            "required": ["script"],
        },
        run=run_run_script,
        dangerous=True,
    )
)
