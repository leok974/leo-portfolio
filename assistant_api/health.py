import os
from fastapi import APIRouter

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


@router.get("/healthz")
def healthz():
    # Gather dynamic reasons (placeholder logic)
    reasons: list[str] = []
    # Optional: if CRYPTO_MODE=disabled, add info reason
    crypto_mode = os.getenv("CRYPTO_MODE", "disabled").lower()
    if crypto_mode == "disabled":
        reasons.append("crypto_disabled")
    # Example: alembic mismatch via env flag for demonstration
    if os.getenv("ALEMBIC_DIVERGED") == "1":
        reasons.append("migration_diverged")
    strict = os.getenv("CRYPTO_STRICT_STARTUP", "0").lower() in ("1","true","yes")
    payload = classify_health(reasons, strict=strict)
    payload.update({
        "crypto_mode": crypto_mode,
    })
    return payload
