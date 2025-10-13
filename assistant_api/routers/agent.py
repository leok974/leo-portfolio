from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..agent.models import recent_runs
from ..agent.runner import DEFAULT_PLAN, run
from ..agent.tasks import REGISTRY
from ..utils.cf_access import require_cf_access

router = APIRouter(prefix="/api/admin/agent", tags=["agent"])


class RunReq(BaseModel):
    plan: list[str] | None = None
    params: dict[str, Any] | None = None


@router.get("/tasks")
def list_tasks(principal: str = Depends(require_cf_access)):
    """List all available agent tasks."""
    return {"tasks": sorted(REGISTRY.keys()), "default": DEFAULT_PLAN}


@router.post("/run")
def run_agent(req: RunReq, principal: str = Depends(require_cf_access)):
    """Run agent with specified plan (or default plan if not provided)."""
    return run(req.plan, req.params)


@router.get("/status")
def status(principal: str = Depends(require_cf_access)):
    """Get recent agent run history."""
    rows = recent_runs()
    items = [
        {
            "run_id": r[0],
            "started": r[1],
            "finished": r[2],
            "ok": int(r[3]),
            "errors": int(r[4]),
            "total": int(r[5]),
        }
        for r in rows
    ]
    return {"recent": items}
