"""FastAPI router for agents_tasks orchestration API."""

import base64
import csv
import io
import json
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, desc, or_, text
from sqlalchemy.orm import Session

from assistant_api.db import get_db
from assistant_api.metrics import emit as emit_metric
from assistant_api.models.agents_tasks import AgentTask
from assistant_api.rbac import require_admin
from assistant_api.schemas.agents_tasks import (
    AgentTaskCreate,
    AgentTaskListOut,
    AgentTaskOut,
    AgentTaskUpdate,
)

router = APIRouter(prefix="/agents/tasks", tags=["agents"])


@router.post("/", response_model=AgentTaskOut, status_code=201)
def create_agent_task(task_data: AgentTaskCreate, db: Session = Depends(get_db)):
    """
    Create a new agent task record.

    Used by orchestrator to log task start.
    """
    db_task = AgentTask(
        task=task_data.task,
        run_id=task_data.run_id,
        status=task_data.status,
        started_at=task_data.started_at or datetime.utcnow(),
        inputs=task_data.inputs,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Emit metric
    try:
        emit_metric(
            "agent.task_created",
            {
                "task": db_task.task,
                "run_id": db_task.run_id,
                "status": db_task.status,
                "id": db_task.id,
            },
        )
    except Exception:
        pass  # Don't let metrics failures affect the API

    return db_task


@router.patch("/{task_id}", response_model=AgentTaskOut)
def update_agent_task(
    task_id: int, task_update: AgentTaskUpdate, db: Session = Depends(get_db)
):
    """
    Update an existing agent task record.

    Used by orchestrator to log task completion, duration, outputs, etc.
    """
    db_task = db.query(AgentTask).filter(AgentTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail=f"Agent task {task_id} not found")

    # Update only provided fields
    update_data = task_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_task, field, value)

    db.commit()
    db.refresh(db_task)

    # Emit metric
    try:
        emit_metric(
            "agent.task_updated",
            {
                "task": db_task.task,
                "run_id": db_task.run_id,
                "status": db_task.status,
                "id": db_task.id,
                "approval_state": db_task.approval_state,
                "duration_ms": db_task.duration_ms,
                "outputs_uri": db_task.outputs_uri,
            },
        )
    except Exception:
        pass  # Don't let metrics failures affect the API

    return db_task


@router.get("/", response_model=list[AgentTaskOut])
def list_agent_tasks_legacy(
    run_id: str | None = None,
    status: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    List agent tasks with optional filters (legacy endpoint for backward compatibility).

    Query params:
    - run_id: Filter by run identifier (e.g., "nightly-2025-01-15")
    - status: Filter by status (queued, running, succeeded, failed, awaiting_approval, skipped)
    - limit: Maximum number of results (default 100)
    """
    query = db.query(AgentTask)

    if run_id:
        query = query.filter(AgentTask.run_id == run_id)
    if status:
        query = query.filter(AgentTask.status == status)

    query = query.order_by(AgentTask.started_at.desc())
    tasks = query.limit(limit).all()
    return tasks


def _encode_cursor(cur: dict) -> str:
    """Encode cursor dict to opaque base64 token."""
    return base64.urlsafe_b64encode(json.dumps(cur).encode("utf-8")).decode("ascii")


def _decode_cursor(token: str) -> dict | None:
    """Decode opaque cursor token to dict."""
    try:
        return json.loads(
            base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8")
        )
    except Exception:
        return None


@router.get("/paged", response_model=AgentTaskListOut)
def list_tasks_paged(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    since: datetime | None = Query(
        None, description="Return tasks with started_at >= this UTC datetime (ISO-8601)"
    ),
    cursor: str | None = Query(
        None, description="Opaque pagination token from previous page"
    ),
    status: list[str] = Query(
        [], description="Filter by status (can be specified multiple times)"
    ),
    task: list[str] = Query(
        [], description="Filter by task name (can be specified multiple times)"
    ),
):
    """
    Keyset pagination ordered by (started_at DESC, id DESC).

    - If `since` is provided, only rows with started_at >= since are considered (still returned newest-first).
    - `cursor` is an opaque token encoding the last (started_at, id) seen.
    - `status` and `task` can be multi-value filters (e.g., ?status=succeeded&status=failed).
    - Returns `items` array and optional `next_cursor` for pagination.
    """
    q = db.query(AgentTask)
    if since is not None:
        q = q.filter(AgentTask.started_at >= since)
    if status:
        q = q.filter(AgentTask.status.in_(status))
    if task:
        q = q.filter(AgentTask.task.in_(task))

    if cursor:
        tok = _decode_cursor(cursor)
        if not tok or "started_at" not in tok or "id" not in tok:
            raise HTTPException(status_code=400, detail="Invalid cursor")
        # keyset: where (started_at < tok.started_at) OR (started_at = tok.started_at AND id < tok.id)
        q = q.filter(
            or_(
                AgentTask.started_at < tok["started_at"],
                and_(
                    AgentTask.started_at == tok["started_at"], AgentTask.id < tok["id"]
                ),
            )
        )

    rows = (
        q.order_by(desc(AgentTask.started_at), desc(AgentTask.id)).limit(limit + 1)
    ).all()
    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = None
    if has_more and items:
        last = items[-1]
        next_cursor = _encode_cursor(
            {"started_at": last.started_at.isoformat(), "id": last.id}
        )

    return AgentTaskListOut(items=items, next_cursor=next_cursor)


@router.get("/paged.csv")
def list_tasks_paged_csv(
    db: Session = Depends(get_db),
    limit: int = Query(1000, ge=1, le=10000),
    since: datetime | None = Query(
        None, description="Return tasks with started_at >= this UTC datetime (ISO-8601)"
    ),
    status: list[str] = Query(
        [], description="Filter by status (can be specified multiple times)"
    ),
    task: list[str] = Query(
        [], description="Filter by task name (can be specified multiple times)"
    ),
):
    """
    Export tasks as CSV with filters.

    - `since` filters by started_at >= since (UTC ISO-8601).
    - `status` and `task` can be multi-value filters.
    - Returns CSV with headers: id, task, run_id, status, started_at, ended_at, duration_ms, outputs_uri.
    - Max limit: 10,000 rows.
    """
    q = db.query(AgentTask)
    if since is not None:
        q = q.filter(AgentTask.started_at >= since)
    if status:
        q = q.filter(AgentTask.status.in_(status))
    if task:
        q = q.filter(AgentTask.task.in_(task))

    rows = q.order_by(desc(AgentTask.started_at), desc(AgentTask.id)).limit(limit).all()

    # Build CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "task",
            "run_id",
            "status",
            "started_at",
            "finished_at",
            "duration_ms",
            "outputs_uri",
            "log_excerpt",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row.id,
                row.task,
                row.run_id,
                row.status,
                row.started_at.isoformat() if row.started_at else "",
                row.finished_at.isoformat() if row.finished_at else "",
                row.duration_ms,
                row.outputs_uri or "",
                (
                    (row.log_excerpt[:100] + "...")
                    if row.log_excerpt and len(row.log_excerpt) > 100
                    else (row.log_excerpt or "")
                ),
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=agent_tasks.csv"},
    )


# --- Admin: prune before date ---
@router.delete("/before")
def prune_before(
    db: Session = Depends(get_db),
    date: datetime = Query(..., description="Delete rows with started_at < date (UTC)"),
    x_admin_key: str = Header(default="", alias="X-Admin-Key"),
):
    """Delete historical rows (admin only). Returns count deleted."""
    admin_key = os.getenv("ADMIN_API_KEY") or ""
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Use a single SQL statement for speed
    res = db.execute(
        text("DELETE FROM agents_tasks WHERE started_at < :cutoff RETURNING 1"),
        {"cutoff": date},
    )
    count = len(res.fetchall())
    db.commit()
    return {"deleted": count, "cutoff": date.isoformat()}


# --- Approval actions (admin only) ---


@router.post("/{task_id}/approve", response_model=AgentTaskOut)
def approve_task(
    task_id: int,
    note: str | None = Query(None, description="Approval note (optional)"),
    actor: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Approve a task awaiting approval (admin only).

    Sets status to 'succeeded', approval_state to 'approved',
    and optionally records approver email and note.
    Emits agent.task_approved metric.
    """
    obj = db.get(AgentTask, task_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")

    now = datetime.utcnow()
    obj.status = "succeeded"
    obj.approval_state = "approved"
    obj.approver = actor.get("email") or obj.approver
    obj.approval_note = note or obj.approval_note

    # Set finished_at and duration_ms if not already set
    if not obj.finished_at:
        obj.finished_at = now
        if obj.started_at:
            obj.duration_ms = obj.duration_ms or int(
                (now - obj.started_at).total_seconds() * 1000
            )

    db.commit()
    db.refresh(obj)

    # Emit metrics (non-blocking)
    try:
        emit_metric(
            "agent.task_approved",
            {
                "id": obj.id,
                "task": obj.task,
                "run_id": obj.run_id,
                "approver": obj.approver,
            },
        )
    except Exception:
        pass  # Don't fail the request if metrics fail

    return obj


@router.post("/{task_id}/reject", response_model=AgentTaskOut)
def reject_task(
    task_id: int,
    note: str | None = Query(None, description="Rejection reason (optional)"),
    actor: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Reject a task awaiting approval (admin only).

    Sets status to 'failed', approval_state to 'rejected',
    and optionally records approver email and rejection reason.
    Emits agent.task_rejected metric.
    """
    obj = db.get(AgentTask, task_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")

    now = datetime.utcnow()
    obj.status = "failed"
    obj.approval_state = "rejected"
    obj.approver = actor.get("email") or obj.approver
    obj.approval_note = note or obj.approval_note

    # Set finished_at and duration_ms if not already set
    if not obj.finished_at:
        obj.finished_at = now
        if obj.started_at:
            obj.duration_ms = obj.duration_ms or int(
                (now - obj.started_at).total_seconds() * 1000
            )

    db.commit()
    db.refresh(obj)

    # Emit metrics (non-blocking)
    try:
        emit_metric(
            "agent.task_rejected",
            {
                "id": obj.id,
                "task": obj.task,
                "run_id": obj.run_id,
                "approver": obj.approver,
            },
        )
    except Exception:
        pass  # Don't fail the request if metrics fail

    return obj


@router.post("/{task_id}/cancel", response_model=AgentTaskOut)
def cancel_task(
    task_id: int,
    note: str | None = Query(None, description="Cancellation note (optional)"),
    actor: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Cancel a task (admin only).

    Sets status to 'skipped', approval_state to 'cancelled',
    and optionally records approver email and cancellation reason.
    Emits agent.task_cancelled metric.
    """
    obj = db.get(AgentTask, task_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")

    now = datetime.utcnow()
    obj.status = "skipped"
    obj.approval_state = "cancelled"
    obj.approver = actor.get("email") or obj.approver
    obj.approval_note = note or obj.approval_note

    # Set finished_at and duration_ms if not already set
    if not obj.finished_at:
        obj.finished_at = now
        if obj.started_at:
            obj.duration_ms = obj.duration_ms or int(
                (now - obj.started_at).total_seconds() * 1000
            )

    db.commit()
    db.refresh(obj)

    # Emit metrics (non-blocking)
    try:
        emit_metric(
            "agent.task_cancelled",
            {
                "id": obj.id,
                "task": obj.task,
                "run_id": obj.run_id,
                "approver": obj.approver,
            },
        )
    except Exception:
        pass  # Don't fail the request if metrics fail

    return obj
