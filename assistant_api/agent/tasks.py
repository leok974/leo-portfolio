from typing import Dict, Callable, Any
import os, json, subprocess, shutil
from .models import emit

TaskFn = Callable[[str, Dict[str, Any]], Dict[str, Any]]
REGISTRY: Dict[str, TaskFn] = {}


def task(name):
    def deco(fn):
        REGISTRY[name] = fn
        return fn

    return deco


@task("projects.sync")
def projects_sync(run_id, params):
    """
    Pull repo metadata → update /assets/data/projects.json
    """
    repos = (
        os.environ.get("SITEAGENT_REPOS")
        or "leok974/ledger-mind,leok974/leo-portfolio"
    ).split(",")
    results = []
    for repo in [r.strip() for r in repos if r.strip()]:
        meta = {"name": repo.split("/")[-1], "description": "", "stargazerCount": 0, "updatedAt": "", "topics": []}
        try:
            if shutil.which("gh"):
                out = subprocess.check_output(
                    [
                        "gh",
                        "repo",
                        "view",
                        repo,
                        "--json",
                        "name,description,stargazerCount,updatedAt,topics",
                    ],
                    text=True,
                )
                meta = json.loads(out)
        except Exception as e:
            emit(run_id, "warn", "projects.sync.repo_failed", {"repo": repo, "err": str(e)})
        results.append(meta)

    dst = "./assets/data/projects.json"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump({"projects": results}, f, indent=2)

    # Optional post-generation step
    try:
        if os.path.exists("./scripts/generate-projects.mjs"):
            subprocess.check_call(["node", "./scripts/generate-projects.mjs"])
    except Exception as e:
        emit(run_id, "warn", "projects.sync.post_generate_failed", {"err": str(e)})

    return {"count": len(results), "file": dst}


@task("sitemap.media.update")
def sitemap_media(run_id, params):
    """Scan /assets for images/videos → regenerate media index JSON."""
    assets_root = "./assets"
    exts = (".webp", ".avif", ".png", ".jpg", ".jpeg", ".mp4", ".webm")
    paths = []
    for root, _, files in os.walk(assets_root):
        for fn in files:
            if fn.lower().endswith(exts):
                p = os.path.join(root, fn).replace("\\", "/")
                paths.append(p)
    paths.sort()
    out_json = "./assets/data/media-index.json"
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({"count": len(paths), "items": paths}, f, indent=2)
    return {"count": len(paths), "file": out_json}


@task("og.generate")
def og_generate(run_id, params):
    """Generate missing OG images (stub for now)."""
    out_dir = "./assets/og"
    os.makedirs(out_dir, exist_ok=True)
    return {"generated": 0, "dir": out_dir}


@task("status.write")
def status_write(run_id, params):
    """Write tiny siteAgent heartbeat JSON for the footer widget."""
    out = {
        "ts": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "last_run_id": params.get("_run_id"),
        "tasks": params.get("_tasks", []),
        "ok": True,
    }
    path = "./assets/data/siteAgent.json"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    return {"file": path}
