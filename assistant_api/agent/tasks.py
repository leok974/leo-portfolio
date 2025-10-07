from typing import Dict, Callable, Any, List, Tuple
import os, json, subprocess, shutil, re
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
    """
    Generate Open Graph preview images into /assets/og/*.png using Playwright.
    Falls back to no-op if Node/Playwright not available.
    """
    out_dir = "./assets/og"
    os.makedirs(out_dir, exist_ok=True)
    script = "./scripts/og-render.mjs"
    template = "./public/og/template.html"
    projects_json = "./assets/data/projects.json"
    if not os.path.exists(script) or not os.path.exists(template) or not os.path.exists(projects_json):
        emit(run_id, "warn", "og.generate.skipped", {"reason": "missing_script_or_template_or_projects"})
        return {"generated": 0, "dir": out_dir, "skipped": True}
    try:
        out = subprocess.check_output(
            ["node", script, "--input", projects_json, "--out", out_dir, "--template", template],
            text=True
        ).strip()
        # script prints a single JSON line with {generated, existing, dir}
        meta = json.loads(out) if out.startswith("{") else {"note": out}
        return meta
    except FileNotFoundError:
        emit(run_id, "warn", "og.generate.node_missing", {})
        return {"generated": 0, "dir": out_dir, "skipped": True}
    except subprocess.CalledProcessError as e:
        emit(run_id, "error", "og.generate.failed", {"code": e.returncode, "out": e.output})
        return {"generated": 0, "dir": out_dir, "error": True}


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


@task("news.sync")
def news_sync(run_id, params):
    """
    Aggregate recent releases or commits per repo → assets/data/news.json
    Prefers `gh api` when available, falls back to minimal metadata.
    """
    repos = (
        os.environ.get("SITEAGENT_REPOS")
        or "leok974/ledger-mind,leok974/leo-portfolio"
    ).split(",")
    items: List[dict] = []
    have_gh = bool(shutil.which("gh"))
    for repo in [r.strip() for r in repos if r.strip()]:
        feed = []
        if have_gh:
            # Try releases first
            try:
                rel = subprocess.check_output(
                    ["gh", "api", f"/repos/{repo}/releases", "--paginate", "-q", ".[0:5]"],
                    text=True,
                    stderr=subprocess.DEVNULL
                )
                feed = [{"repo": repo, "type": "release", **r} for r in json.loads(rel)]
            except Exception:
                pass
            # If no releases, fall back to commits
            if not feed:
                try:
                    com = subprocess.check_output(
                        ["gh", "api", f"/repos/{repo}/commits", "-q", ".[0:5]"],
                        text=True,
                        stderr=subprocess.DEVNULL
                    )
                    commits = json.loads(com)
                    for c in commits:
                        feed.append({
                            "repo": repo,
                            "type": "commit",
                            "sha": c.get("sha"),
                            "message": (c.get("commit", {}).get("message") or "").split("\n")[0],
                            "date": c.get("commit", {}).get("committer", {}).get("date"),
                            "html_url": c.get("html_url"),
                        })
                except Exception:
                    pass
        if not feed:
            # Minimal fallback if gh is missing or API failed
            feed = [{"repo": repo, "type": "info", "note": "gh_not_available"}]
        items.extend(feed)
    dst = "./assets/data/news.json"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump({"items": items}, f, indent=2)
    return {"count": len(items), "file": dst}


@task("links.validate")
def links_validate(run_id, params):
    """
    Static link checker: scans local HTML files for href/src and verifies local targets exist.
    External links are ignored. Produces assets/data/link-check.json
    """
    roots = ["./", "./public"]
    html_paths: List[str] = []
    for root in roots:
        if not os.path.exists(root):
            continue
        for r, _, files in os.walk(root):
            for fn in files:
                if fn.lower().endswith(".html"):
                    html_paths.append(os.path.join(r, fn))
    href_re = re.compile(r"""(?:href|src)=["']([^"']+)["']""", re.I)
    missing: List[Tuple[str, str]] = []
    checked = 0
    for html in html_paths:
        try:
            with open(html, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception:
            continue
        for url in href_re.findall(content):
            checked += 1
            if re.match(r"^(https?:)?//", url) or url.startswith("mailto:") or url.startswith("data:"):
                continue
            # Normalize local path
            local = url
            if local.startswith("/"):
                local = "." + local  # root-relative within project
            else:
                # relative to the HTML file's directory
                local = os.path.normpath(os.path.join(os.path.dirname(html), local))
            if "#" in local:
                local = local.split("#", 1)[0]
            if local and not os.path.splitext(local)[1] and not local.endswith("/"):
                # If it's a no-extension path, allow implicit directory index
                if os.path.isdir(local) and os.path.exists(os.path.join(local, "index.html")):
                    continue
            if local and not os.path.exists(local):
                missing.append((html.replace("\\","/"), url))
    out = {
        "checked": checked,
        "html_files": len(html_paths),
        "missing": [{"file": f, "url": u} for f, u in missing],
    }
    dst = "./assets/data/link-check.json"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    status = {"file": dst, "missing": len(missing), "checked": checked}
    if missing:
        emit(run_id, "warn", "links.validate.missing", status)
    return status
