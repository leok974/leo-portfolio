"""Agent system API routes."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..agents.database import get_db
from ..agents.models import AgentTask
from ..agents.runner import create_task, run_task
from ..agents.spec import load_registry
from ..agents.telemetry import track_status_change

router = APIRouter(prefix="/agents", tags=["agents"])


# --- Request/Response Models ---


class RunReq(BaseModel):
    """Request to run an agent task."""

    agent: str
    task: str
    inputs: dict[str, Any] | None = None


class ApproveReq(BaseModel):
    """Request to approve/reject a task."""

    task_id: str
    note: str | None = None


# --- Helper: Get Current User (Optional Auth) ---


def get_current_user_optional():
    """Get current user for approval attribution.

    In production, this would extract user info from CF Access headers or JWT.
    For now, returns None (approval attribution is optional).
    """
    return None  # TODO: Replace with real auth if needed


# --- Routes ---


@router.get("/registry")
def get_registry(user=Depends(get_current_user_optional)):
    """Get agent registry with goals, tools, and policies."""
    reg = load_registry()
    return {k: v.model_dump() for k, v in reg.items()}


@router.post("/run")
async def run(
    req: RunReq, db: Session = Depends(get_db), user=Depends(get_current_user_optional)
):
    """
    Run an agent task.

    Returns task_id and status. If needs_approval is True,
    task will wait in 'awaiting_approval' status.
    """
    # RBAC enforcement could go here
    try:
        t = create_task(db, req.agent, req.task, req.inputs or {})
    except ValueError as e:
        # Unknown agent or validation error
        raise HTTPException(status_code=400, detail=str(e))

    # Fire-and-forget within request lifetime (no background promises)
    await run_task(db, t)

    return {
        "task_id": t.id,
        "status": t.status,
        "needs_approval": t.needs_approval,
        "outputs_uri": t.outputs_uri,
    }


@router.get("/status")
def status(
    task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user_optional)
):
    """Get task status and details."""
    t = db.get(AgentTask, task_id)
    if not t:
        raise HTTPException(404, "task not found")

    return {
        "task_id": t.id,
        "agent": t.agent,
        "task": t.task,
        "status": t.status,
        "needs_approval": t.needs_approval,
        "outputs_uri": t.outputs_uri,
        "logs_tail": (t.logs or "")[-1000:],
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.post("/approve")
def approve(
    req: ApproveReq,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    """Approve a task waiting for approval."""
    t = db.get(AgentTask, req.task_id)
    if not t:
        raise HTTPException(404, "task not found")

    if t.status != "awaiting_approval":
        raise HTTPException(409, f"task not awaiting approval (status={t.status})")

    t.status = "succeeded"
    t.approved_by = getattr(user, "email", "unknown")
    t.approval_note = req.note
    db.commit()

    track_status_change(
        t.agent, t.task, t.id, "succeeded", {"approved_by": t.approved_by}
    )

    return {"ok": True, "task_id": t.id, "status": t.status}


@router.post("/reject")
def reject(
    req: ApproveReq,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    """Reject a task."""
    t = db.get(AgentTask, req.task_id)
    if not t:
        raise HTTPException(404, "task not found")

    if t.status not in ("awaiting_approval", "running", "queued"):
        raise HTTPException(409, f"task not rejectable (status={t.status})")

    t.status = "rejected"
    t.approved_by = getattr(user, "email", "unknown")
    t.approval_note = req.note
    db.commit()

    track_status_change(
        t.agent, t.task, t.id, "rejected", {"rejected_by": t.approved_by}
    )

    return {"ok": True, "task_id": t.id, "status": t.status}


@router.post("/cancel")
def cancel(
    req: ApproveReq,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    """
    Abort a running/queued task by marking it as 'canceled'.
    Note: tasks execute synchronously in the current design, so 'running' is typically short-lived.
    This endpoint is future-safe for background schedulers.
    """
    t = db.get(AgentTask, req.task_id)
    if not t:
        raise HTTPException(404, "task not found")

    if t.status not in ("queued", "running"):
        raise HTTPException(409, f"task not cancelable (status={t.status})")

    t.status = "canceled"
    t.approved_by = getattr(user, "email", "unknown")
    t.approval_note = (req.note or "").strip() or "Canceled by user"
    db.commit()

    track_status_change(
        t.agent, t.task, t.id, "canceled", {"canceled_by": t.approved_by}
    )

    return {"ok": True, "task_id": t.id, "status": t.status}
