from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from pydantic import BaseModel

from .tools.base import get_tool, is_allow_tools, list_tools, persist_audit

SYSTEM = (
  "You are a careful planner. When a user asks for repo info, choose at most 2 tool calls.\n"
  "Return ONLY JSON in the shape {\"plan\":[{\"tool\":\"name\",\"args\":{...}}]}.\n"
  "Pick from these tools:\n"
  "{tools}\n"
  "Prefer search_repo -> read_file to show exact evidence.\n"
  "If the user asks for a task to remember, use create_todo with a concise title.\n"
)

class PlanStep(BaseModel):
    tool: str
    args: dict[str, Any] = {}

class PlanOut(BaseModel):
    plan: list[PlanStep] = []

def _heuristic_plan(question: str) -> PlanOut:
    q = (question or "").lower()
    steps: list[PlanStep] = []
    # Simple rebuild hint → use run_script if user mentions rebuild index or rag
    if any(w in q for w in ["rebuild rag", "rebuild the rag", "rebuild index", "rebuild the index"]):
        # naive path extract (drive-letter or ./data style)
        mpath = re.search(r"([a-zA-Z]:[\\/][^\s]+|\./data/[^\s]+|/data/[^\s]+)", question or "")
        dbp = mpath.group(1) if mpath else None
        args: dict[str, Any] = {"script": "scripts/rag-build-index.ps1"}
        if dbp:
            args["args"] = ["-DbPath", dbp]
        steps.append(PlanStep(tool="run_script", args=args))
        return PlanOut(plan=steps)
    # Simple detection: mention of find/search/show/read + keyword to search
    m = re.search(r"(?:find|search|show|read)\s+([\w\-\./]{2,})", q)
    keyword = None
    if m:
        keyword = m.group(1)
    # Fallback: pick first quoted segment
    if not keyword:
        qm = re.search(r"['\"]([^'\"]{2,})['\"]", (question or ""))
        if qm:
            keyword = qm.group(1)
    if keyword:
        steps.append(PlanStep(tool="search_repo", args={"query": keyword, "k": 10}))
        steps.append(PlanStep(tool="read_file", args={"path": "", "start": 1, "end": 40}))  # filled after search by executor? keep placeholder
    # TODO creation when phrasing includes create/add todo
    if any(w in q for w in ["todo:", "create todo", "add todo", "remember to"]):
        title = question
        steps.append(PlanStep(tool="create_todo", args={"title": title[:120]}))
    return PlanOut(plan=steps[:2])

async def plan_actions(question: str) -> PlanOut:
    # Try local-first JSON completion if available
    try:
        from .llm_client import completion_json  # type: ignore
    except Exception:
        completion_json = None

    tools_text = json.dumps(list_tools(), ensure_ascii=False, indent=2)
    # Avoid str.format on SYSTEM because it contains JSON braces; just replace the placeholder
    prompt = SYSTEM.replace("{tools}", tools_text) + f"\nUser: {question}\nJSON:"
    if completion_json is not None:
        try:
            res = await completion_json({"messages":[{"role":"system","content":prompt}] , "temperature":0})
            data = json.loads(res.get("content") or "{}")
            return PlanOut(**data)
        except Exception:
            pass
    # Heuristic fallback when no JSON completion available
    return _heuristic_plan(question)

def execute_plan(plan: PlanOut) -> dict[str, Any]:
    transcripts: list[dict[str, Any]] = []
    for step in plan.plan[:2]:
        spec = get_tool(step.tool)
        if not spec:
            transcripts.append({"tool": step.tool, "error": "unknown tool"})
            continue
        if spec.dangerous and not is_allow_tools():
            transcripts.append({"tool": step.tool, "error": "not allowed (dangerous)"})
            continue
        args = dict(step.args or {})
        # Simple chaining: if read_file missing path, and we have previous search_repo hit, use first hit path
        if step.tool == "read_file" and not args.get("path"):
            try:
                prev = next((t for t in transcripts if t.get("tool") == "search_repo" and isinstance(t.get("result"), dict)), None)
                hits = (prev or {}).get("result", {}).get("hits", [])
                if hits:
                    args["path"] = hits[0]["path"]
                    args.setdefault("start",  max(1, int((hits[0].get("line") or 1) - 5)))
                    args.setdefault("end",    int(args["start"]) + 20)
            except Exception:
                pass
        try:
            out = spec.run(args)
            transcripts.append({"tool": step.tool, "args": args, "result": out})
        except Exception as e:
            transcripts.append({"tool": step.tool, "args": args, "error": str(e)})
    persist_audit({"type": "execute_plan", "count": len(transcripts)})
    return {"ok": True, "steps": transcripts}
