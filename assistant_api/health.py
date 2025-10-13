import os
import pathlib
import re
import sqlite3

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

router = APIRouter()

# Reason severity catalog (extendable)
INFO_REASONS = {"crypto_disabled"}
WARN_REASONS = {"alembic_out_of_sync", "migration_diverged"}


def classify_health(reasons: list[str], strict: bool = False) -> dict:
    """Classify overall health.

    - Filter out info-only reasons unless strict and they imply degraded.
    - If any warn reasons remain -> degraded.
    - Otherwise ok.
    """
    info = [r for r in reasons if r in INFO_REASONS]
    warn = [r for r in reasons if r in WARN_REASONS]
    # Unknown reasons treat as warn (defensive)
    unknown = [r for r in reasons if r not in INFO_REASONS and r not in WARN_REASONS]
    effective_warn = warn + unknown

    degraded = bool(effective_warn)
    # In strict mode, treat info reasons as degraded if any present
    if strict and info and not degraded:
        degraded = True

    status = "degraded" if degraded else "ok"
    filtered_reasons = effective_warn if degraded else []
    return {
        "ok": not degraded,
        "status": status,
        "reasons": filtered_reasons,
        "info_reasons": info,
        "warn_reasons": warn,
        "unknown_reasons": unknown,
    }


@router.get("/live")
def live():
    return {"ok": True}


def _alembic_versions_dir() -> pathlib.Path:
    # Common relative locations (adjust if project adds migrations directory)
    candidates = [
        pathlib.Path("assistant_api/migrations/versions"),
        pathlib.Path("migrations/versions"),
    ]
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]

def _list_migration_heads(dir_path: pathlib.Path) -> set[str]:
    heads = set()
    if not dir_path.exists():
        return heads
    for f in dir_path.iterdir():
        if f.is_file():
            # Alembic migration filenames often start with revision hash (alphanumeric)
            m = re.match(r"^([0-9a-fA-F]+)_", f.name)
            if m:
                heads.add(m.group(1))
    return heads

def _read_alembic_version_from_db(db_path: str) -> set[str]:
    revs = set()
    if not os.path.exists(db_path):
        return revs
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        # Standard alembic version table name
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version';")
        if cur.fetchone():
            cur.execute("SELECT version_num FROM alembic_version;")
            for row in cur.fetchall():
                if row and row[0]:
                    revs.add(str(row[0]))
        conn.close()
    except Exception:
        pass
    return revs

def gather_health_reasons() -> tuple[list[str], dict]:
    reasons: list[str] = []
    extra: dict = {}
    crypto_mode = os.getenv("CRYPTO_MODE", "disabled").lower()
    if crypto_mode == "disabled":
        reasons.append("crypto_disabled")
    extra["crypto_mode"] = crypto_mode

    # Alembic checks
    db_path = os.getenv("RAG_DB", "./data/rag.sqlite")
    versions_dir = _alembic_versions_dir()
    declared = _list_migration_heads(versions_dir)
    applied = _read_alembic_version_from_db(db_path)
    extra["alembic"] = {
        "declared_heads": sorted(declared),
        "applied": sorted(applied),
    }
    if declared and applied and not applied.issubset(declared):
        # Applied migration not present in declared heads -> divergence
        reasons.append("migration_diverged")
    # Out of sync if newest declared head not applied
    if declared:
        # Basic heuristic: if any declared head missing from applied, mark out_of_sync
        missing = declared - applied
        if missing:
            reasons.append("alembic_out_of_sync")

    return reasons, extra

@router.get("/healthz")
def healthz():
    reasons, extra = gather_health_reasons()
    strict = os.getenv("CRYPTO_STRICT_STARTUP", "0").lower() in ("1","true","yes")
    payload = classify_health(reasons, strict=strict)
    payload.update(extra)
    return payload

@router.get("/metrics/health", response_class=PlainTextResponse)
def health_metrics():
    reasons, _extra = gather_health_reasons()
    strict = os.getenv("CRYPTO_STRICT_STARTUP", "0").lower() in ("1","true","yes")
    classified = classify_health(reasons, strict=strict)
    lines = ["# HELP health_reason Active health reasons by severity (1=active)\n# TYPE health_reason gauge"]
    # Emit info reasons even if not degrading (value 1 when present)
    for r in classified.get("info_reasons", []):
        lines.append(f'health_reason{{reason="{r}",severity="info"}} 1')
    for r in classified.get("warn_reasons", []):
        lines.append(f'health_reason{{reason="{r}",severity="warn"}} 1')
    for r in classified.get("unknown_reasons", []):
        lines.append(f'health_reason{{reason="{r}",severity="unknown"}} 1')
    # Also emit an overall gauge
    lines.append(f'health_overall{{status="{classified.get("status")}"}} {1 if not classified.get("ok") else 0}')
    return "\n".join(lines) + "\n"
