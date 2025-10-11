"""Agent task runner with sub-agent dispatch."""
import json
import uuid
import pathlib
import asyncio
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session

from .models import AgentTask
from .spec import load_registry
from .telemetry import track_status_change
from .tools.seo_validate import seo_validate_to_artifacts
from .tools.code_review import run_code_review
from .tools.dx_integrate import run_dx_integrate
from .tools.infra_scale import run_infra_scale

ARTIFACTS_DIR = pathlib.Path("./artifacts")
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def _artifact_path(task_id: str) -> pathlib.Path:
    """Get artifact directory for task."""
    p = ARTIFACTS_DIR / task_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def create_task(db: Session, agent: str, task: str, inputs: Dict[str, Any]) -> AgentTask:
    """Create a new agent task."""
    reg = load_registry()
    if agent not in reg:
        raise ValueError(f"Unknown agent: {agent}")

    t = AgentTask(
        id=str(uuid.uuid4()),
        agent=agent,
        task=task,
        inputs=inputs or {},
        status="queued",
        needs_approval=not reg[agent].allow_auto or task not in ("validate",),  # example policy
    )
    db.add(t)
    db.commit()
    db.refresh(t)

    # Track task creation
    track_status_change(agent, task, t.id, "queued", {"needs_approval": t.needs_approval})

    return t


async def run_task(db: Session, t: AgentTask) -> AgentTask:
    """Execute agent task."""
    # Flip to running
    t.status = "running"
    db.commit()
    track_status_change(t.agent, t.task, t.id, "running")

    # Route to sub-agent
    try:
        # Ensure sub-agent can write artifacts directly into this task folder
        task_art_dir = _artifact_path(t.id)
        # Inject a private hint key (won't persist to outputs)
        _inputs = dict(t.inputs or {})
        _inputs["_artifact_dir"] = str(task_art_dir.resolve())
        outputs, logs = await _dispatch_to_agent(t.agent, t.task, _inputs)

        # Save artifacts
        (task_art_dir / "outputs.json").write_text(json.dumps(outputs, indent=2), encoding="utf-8")
        (task_art_dir / "logs.txt").write_text(logs or "", encoding="utf-8")

        # Prefer the merged report if present; else point at the task folder
        report_json = outputs.get("artifacts", {}).get("report_json") if isinstance(outputs, dict) else None
        t.outputs_uri = report_json or str(task_art_dir.resolve())
        t.logs = logs

        # Gate approval if needed
        if t.needs_approval:
            t.status = "awaiting_approval"
            track_status_change(t.agent, t.task, t.id, "awaiting_approval")
        else:
            t.status = "succeeded"
            track_status_change(t.agent, t.task, t.id, "succeeded")
    except Exception as e:
        t.status = "failed"
        t.logs = (t.logs or "") + f"\nERROR: {e}"
        track_status_change(t.agent, t.task, t.id, "failed", {"error": str(e)})
    finally:
        db.commit()
        db.refresh(t)

    return t


# ---- Sub-agent dispatch (stubs - replace with real tools later) ----

async def _dispatch_to_agent(agent: str, task: str, inputs: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Route task to appropriate agent implementation."""
    if agent == "projects":
        return await _agent_projects(task, inputs)
    if agent == "seo":
        return await _agent_seo(task, inputs)
    if agent == "branding":
        return await _agent_branding(task, inputs)
    if agent == "content":
        return await _agent_content(task, inputs)
    if agent == "orchestrator":
        return await _agent_orchestrator(task, inputs)
    if agent == "code":
        return await _agent_code(task, inputs)
    if agent == "dx":
        return await _agent_dx(task, inputs)
    if agent == "infra":
        return await _agent_infra(task, inputs)

    # Default no-op
    return {"ok": True, "note": "no-op"}, f"[{agent}.{task}] no-op completed"


# --- Example stub implementations (replace later with real tools) ---

async def _agent_projects(task: str, inputs: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Projects agent - GitHub sync and project curation."""
    await asyncio.sleep(0)  # yield

    if task == "sync":
        repos = inputs.get("repos", [])
        return {
            "synced_repos": repos,
            "curated": False
        }, f"[projects.sync] simulated sync of {len(repos)} repos"

    if task == "curate":
        return {
            "curated_sections": ["projects", "featured"]
        }, "[projects.curate] simulated curation"

    return {"ok": True}, f"[projects.{task}] no-op"


async def _agent_seo(task: str, inputs: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """SEO agent - validation and auto-fix."""
    await asyncio.sleep(0)

    if task == "validate":
        # Real run: guardrails + lighthouse → artifacts folder (created by caller)
        # Artifact folder will be created in run_task(); we re-open it here
        # by computing the parent from inputs if provided, else the runner will write after.
        # The runner guarantees artifacts/<task_id> exists before writing outputs.json/logs.txt.
        artifact_hint = inputs.get("_artifact_dir")  # internal hint injected by run_task
        if not artifact_hint:
            # Safe fallback: local scratch; the caller run_task will still save outputs.json/logs.txt into the canonical dir.
            artifact_dir = pathlib.Path("./artifacts").joinpath("tmp-seo-validate")
        else:
            artifact_dir = pathlib.Path(artifact_hint)

        pages = inputs.get("pages") or "sitemap://current"
        summary = seo_validate_to_artifacts(artifact_dir, pages_hint=pages)
        return summary, "[seo.validate] guardrails+lighthouse executed"

    if task == "tune":
        return {
            "patch": "git://branch/seo-autofix-<hash>",
            "changes": ["meta descriptions optimized", "alt text added"]
        }, "[seo.tune] autofix simulated"

    return {"ok": True}, f"[seo.{task}] no-op"


async def _agent_branding(task: str, inputs: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Branding agent - logo and theme generation."""
    await asyncio.sleep(0)

    if task == "logo":
        return {
            "candidates": ["logo_v1.svg", "logo_v2.svg"]
        }, "[branding.logo] simulated logo generation"

    if task == "theme":
        return {
            "candidates": ["palette_a.json", "palette_b.json"]
        }, "[branding.theme] simulated palette generation"

    return {"ok": True}, f"[branding.{task}] no-op"


async def _agent_content(task: str, inputs: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Content agent - summarization and rewriting."""
    await asyncio.sleep(0)

    if task == "summarize":
        source = inputs.get("source", "unknown")
        return {
            "drafts": [
                {"variant": "short", "text": "Summary...", "length": 100},
                {"variant": "long", "text": "Detailed summary...", "length": 300}
            ]
        }, f"[content.summarize] simulated for {source}"

    if task == "rewrite":
        return {
            "variants": [
                {"style": "professional", "text": "Rewritten in professional tone..."},
                {"style": "casual", "text": "Rewritten in casual tone..."}
            ]
        }, "[content.rewrite] simulated rewrite"

    return {"ok": True}, f"[content.{task}] no-op"


async def _agent_orchestrator(task: str, inputs: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Orchestrator agent - scheduling and routing."""
    await asyncio.sleep(0)

    if task == "schedule":
        return {
            "scheduled_tasks": inputs.get("tasks", []),
            "next_run": "2025-01-01T00:00:00Z"
        }, "[orchestrator.schedule] simulated scheduling"

    if task == "route":
        query = inputs.get("query", "")
        return {
            "routed_to": "seo",
            "reason": "Query matches SEO patterns"
        }, f"[orchestrator.route] routed query: {query}"

    return {"ok": True}, f"[orchestrator.{task}] no-op"


async def _agent_code(task: str, inputs: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Code agent - review and analysis."""
    await asyncio.sleep(0)

    if task == "review":
        artifact_dir = pathlib.Path(inputs.get("_artifact_dir") or "./artifacts/tmp-code-review")
        summary = run_code_review(artifact_dir)
        return summary, "[code.review] executed"

    return {"ok": True}, f"[code.{task}] no-op"


async def _agent_dx(task: str, inputs: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """DX agent - developer experience integrations."""
    await asyncio.sleep(0)

    if task == "integrate":
        artifact_dir = pathlib.Path(inputs.get("_artifact_dir") or "./artifacts/tmp-dx-integrate")
        summary = run_dx_integrate(artifact_dir)
        return summary, "[dx.integrate] executed"

    return {"ok": True}, f"[dx.{task}] no-op"


async def _agent_infra(task: str, inputs: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Infra agent - infrastructure scaling."""
    await asyncio.sleep(0)

    if task == "scale":
        artifact_dir = pathlib.Path(inputs.get("_artifact_dir") or "./artifacts/tmp-infra-scale")
        summary = run_infra_scale(artifact_dir)
        return summary, "[infra.scale] executed"

    return {"ok": True}, f"[infra.{task}] no-op"
