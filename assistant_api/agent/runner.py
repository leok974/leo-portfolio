import traceback
import uuid
from typing import Any, Dict, List

from .models import emit, insert_job, update_job
from .tasks import REGISTRY

DEFAULT_PLAN = [
    "projects.sync",
    "media.scan",
    "sitemap.media.update",
    "og.generate",
    "news.sync",
    "links.validate",
    "status.write",
]


def run(plan: list[str] | None = None, params: dict[str, Any] | None = None):
    run_id = str(uuid.uuid4())
    tasks = plan or DEFAULT_PLAN
    params = {**(params or {}), "_run_id": run_id, "_tasks": tasks}
    emit(run_id, "info", "run.start", {"tasks": tasks})
    for t in tasks:
        insert_job(run_id, t, meta={"params": params})
        try:
            result = REGISTRY[t](run_id, params)
            update_job(run_id, t, "ok", meta=result)
            emit(run_id, "info", "task.ok", {"task": t, "result": result})
        except Exception as e:
            update_job(run_id, t, "error", meta={"error": str(e)})
            emit(
                run_id,
                "error",
                "task.error",
                {"task": t, "error": str(e), "trace": traceback.format_exc()},
            )
    emit(run_id, "info", "run.end", {})
    return {"run_id": run_id, "tasks": tasks}
