from typing import Dict, Callable, Any, List, Tuple
import os, json, subprocess, shutil, re, io, urllib.request, urllib.error, socket, ipaddress
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
                        "name,description,stargazerCount,updatedAt,repositoryTopics",
                    ],
                    text=True,
                )
                data = json.loads(out)
                # Extract topic names from repositoryTopics
                if "repositoryTopics" in data:
                    data["topics"] = [t["topic"]["name"] for t in data.get("repositoryTopics", {}).get("nodes", [])]
                    del data["repositoryTopics"]
                meta = data
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
            [
                "node", script,
                "--input", projects_json,
                "--out", out_dir,
                "--template", template,
                "--overrides", "./assets/data/og-overrides.json",
            ],
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
    """
    Write a tiny JSON heartbeat siteAgent.json for the footer/status widget.
    Includes `brand`, sourced from assets/data/og-overrides.json or SITEAGENT_BRAND.
    """
    # Resolve brand from overrides or env
    brand = os.environ.get("SITEAGENT_BRAND") or "LEO KLEMET — SITEAGENT"
    try:
        ov_path = "./assets/data/og-overrides.json"
        if os.path.exists(ov_path):
            import json as _json
            with open(ov_path, "r", encoding="utf-8") as f:
                ov = _json.load(f)
                if isinstance(ov, dict) and ov.get("brand"):
                    brand = str(ov["brand"])
    except Exception as e:
        emit(run_id, "warn", "status.brand_override_failed", {"err": str(e)})

    out = {
        "ts": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "last_run_id": params.get("_run_id"),
        "tasks": params.get("_tasks", []),
        "ok": True,
        "brand": brand,
    }
    path = "./assets/data/siteAgent.json"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    return {"file": path}


@task("overrides.update")
def overrides_update(run_id, params):
    """
    Update OG/card overrides file:
      - params.overrides: full dict merge (brand/title_alias/repo_alias)
      - params.rename: { repo?: str, from?: str, to: str } convenience
      - params.brand: string (shortcut)
    Writes ./assets/data/og-overrides.json
    """
    dst = "./assets/data/og-overrides.json"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    # load current
    cur = {}
    if os.path.exists(dst):
        try:
            with open(dst, "r", encoding="utf-8") as f:
                cur = json.load(f) or {}
        except Exception as e:
            emit(run_id, "warn", "overrides.update.read_fail", {"err": str(e)})
            cur = {}
    # normalize maps
    cur.setdefault("title_alias", {})
    cur.setdefault("repo_alias", {})
    cur.setdefault("title_logo", {})
    cur.setdefault("repo_logo", {})
    changed = {}
    # brand shortcut
    if isinstance(params.get("brand"), str) and params["brand"].strip():
        cur["brand"] = params["brand"].strip()
        changed["brand"] = cur["brand"]
    # merge block
    if isinstance(params.get("overrides"), dict):
        o = params["overrides"]
        if "brand" in o and isinstance(o["brand"], str):
            cur["brand"] = o["brand"]
            changed["brand"] = cur["brand"]
        if "title_alias" in o and isinstance(o["title_alias"], dict):
            cur["title_alias"].update(o["title_alias"])
            changed.setdefault("title_alias", {}).update(o["title_alias"])
        if "repo_alias" in o and isinstance(o["repo_alias"], dict):
            cur["repo_alias"].update(o["repo_alias"])
            changed.setdefault("repo_alias", {}).update(o["repo_alias"])
    # convenience rename
    rn = params.get("rename") or {}
    if isinstance(rn, dict) and isinstance(rn.get("to"), str) and rn["to"].strip():
        new_name = rn["to"].strip()
        if isinstance(rn.get("repo"), str) and rn["repo"].strip():
            cur["repo_alias"][rn["repo"].strip()] = new_name
            changed.setdefault("repo_alias", {})[rn["repo"].strip()] = new_name
        elif isinstance(rn.get("from"), str) and rn["from"].strip():
            cur["title_alias"][rn["from"].strip()] = new_name
            changed.setdefault("title_alias", {})[rn["from"].strip()] = new_name
        else:
            emit(run_id, "warn", "overrides.update.rename_ignored",
                 {"reason": "need repo or from", "rename": rn})
    # logo assignment/removal:
    # params.logo = { repo?: str, title?: str, path?: str, remove?: bool }
    lg = params.get("logo") or {}
    if isinstance(lg, dict):
        if lg.get("remove"):
            if lg.get("repo") and lg["repo"].strip() in cur["repo_logo"]:
                del cur["repo_logo"][lg["repo"].strip()]
                changed.setdefault("repo_logo", {})[lg["repo"].strip()] = None
            elif lg.get("title") and lg["title"].strip() in cur["title_logo"]:
                del cur["title_logo"][lg["title"].strip()]
                changed.setdefault("title_logo", {})[lg["title"].strip()] = None
            else:
                emit(run_id, "warn", "overrides.update.logo_remove_ignored",
                     {"reason": "not found", "logo": lg})
        elif isinstance(lg.get("path"), str) and lg["path"].strip():
            pth = lg["path"].strip()
            if lg.get("repo"):
                cur["repo_logo"][lg["repo"].strip()] = pth
                changed.setdefault("repo_logo", {})[lg["repo"].strip()] = pth
            elif lg.get("title"):
                cur["title_logo"][lg["title"].strip()] = pth
                changed.setdefault("title_logo", {})[lg["title"].strip()] = pth
            else:
                emit(run_id, "warn", "overrides.update.logo_ignored",
                     {"reason": "need repo or title", "logo": lg})
    # write
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(cur, f, indent=2)
    emit(run_id, "info", "overrides.update.ok", {"changed": changed})
    return {"file": dst, "changed": changed, "brand": cur.get("brand")}


@task("logo.fetch")
def logo_fetch(run_id, params):
    """
    Download a logo image from a URL and register it for a repo or title.
    Params:
      - url: http(s) URL (required)
      - repo: owner/name (optional)
      - title: project title (optional)
      - name: preferred file base name (optional)
      - max_bytes: cap download size (default 3 MiB)
    Saves to ./assets/logos/<slug>.(png|svg|webp|jpg|gif). If Pillow is available,
    converts raster formats to PNG.
    """
    url = (params.get("url") or "").strip()
    if not url or not re.match(r"^https?://", url, re.I):
        raise ValueError("logo.fetch: 'url' must be http(s)")
    repo = (params.get("repo") or "").strip()
    title = (params.get("title") or "").strip()
    name = (params.get("name") or title or (repo.split("/")[-1] if repo else "")) or "logo"
    max_mb = float(os.environ.get("SITEAGENT_LOGO_MAX_MB", "3"))
    max_bytes = int(params.get("max_bytes") or (max_mb * 1024 * 1024))
    require_https = not bool(os.environ.get("SITEAGENT_LOGO_ALLOW_HTTP"))
    if require_https and url.lower().startswith("http://"):
        raise ValueError("logo.fetch: plain HTTP disabled (set SITEAGENT_LOGO_ALLOW_HTTP=1 to allow)")

    # SSRF guard: resolve host and block private/loopback/link-local
    from urllib.parse import urlparse
    u = urlparse(url)
    host = u.hostname or ""
    try:
        infos = socket.getaddrinfo(host, None)
        for _family, _type, _proto, _canon, sockaddr in infos:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                raise ValueError(f"logo.fetch: blocked non-public IP {ip}")
    except socket.gaierror as e:
        raise ValueError(f"logo.fetch: cannot resolve host {host}: {e}")

    # Optional host allowlist (suffix match)
    allow_hosts = [h.strip().lower() for h in os.environ.get("SITEAGENT_LOGO_HOSTS", "").split(",") if h.strip()]
    if allow_hosts and not any(host.lower().endswith(suf) for suf in allow_hosts):
        raise ValueError(f"logo.fetch: host not allowed by SITEAGENT_LOGO_HOSTS: {host}")

    def slug(s: str) -> str:
        return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9-]+", "-", s.lower())).strip("-") or "logo"

    # Fetch
    req = urllib.request.Request(url, headers={"User-Agent": "siteAgent/1.0 (+logo.fetch)"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            clen = resp.headers.get("Content-Length")
            if clen and int(clen) > max_bytes:
                raise ValueError(f"logo.fetch: remote file too large ({clen} bytes)")
            buf = io.BytesIO()
            chunk = resp.read(65536)
            total = 0
            while chunk:
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError(f"logo.fetch: download exceeded {max_bytes} bytes")
                buf.write(chunk)
                chunk = resp.read(65536)
            data = buf.getvalue()
    except urllib.error.URLError as e:
        raise ValueError(f"logo.fetch: download failed: {e}") from e

    # Decide extension
    ext_map = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
        "image/svg+xml": "svg",
        "image/gif": "gif",
    }
    ext = ext_map.get(ctype)
    if not ext:
        # Fall back to URL suffix
        m = re.search(r"\.([a-z0-9]{3,4})(?:\?|#|$)", url, re.I)
        ext = (m.group(1).lower() if m else "png")
        if ext not in {"png", "jpg", "jpeg", "webp", "svg", "gif"}:
            ext = "png"

    logos_dir = "./assets/logos"
    os.makedirs(logos_dir, exist_ok=True)
    base = slug(name)
    out_path = os.path.join(logos_dir, f"{base}.{ext}")

    # Optional: convert raster → PNG if Pillow available and ext != svg/png
    final_path = out_path
    try:
        if ext == "svg":
            # sanitize SVG: strip scripts/foreignObject and event attributes
            try:
                import xml.etree.ElementTree as ET
                txt = data.decode("utf-8", errors="ignore")
                # Remove script/foreignObject
                txt = re.sub(r"<\s*(script|foreignObject)[\s\S]*?<\s*/\s*\1\s*>", "", txt, flags=re.I)
                # Remove on* event attributes
                txt = re.sub(r"\son[a-zA-Z]+\s*=\s*\"[^\"]*\"", "", txt)
                txt = re.sub(r"\son[\w-]+\s*=\s*'[^']*'", "", txt)
                with open(out_path, "w", encoding="utf-8") as f:
                    f.write(txt)
                final_path = out_path
            except Exception:
                with open(out_path, "wb") as f:
                    f.write(data)
                final_path = out_path
        elif ext in {"jpg", "jpeg", "webp", "gif"}:
            try:
                from PIL import Image  # type: ignore
                img = Image.open(io.BytesIO(data)).convert("RGBA")
                final_path = os.path.join(logos_dir, f"{base}.png")
                img.save(final_path, format="PNG")
            except Exception:
                # If Pillow not present or conversion fails, just write original
                with open(out_path, "wb") as f:
                    f.write(data)
                final_path = out_path
        else:
            # png or svg or other allowed → write as-is
            with open(out_path, "wb") as f:
                f.write(data)
            final_path = out_path
    except Exception as e:
        emit(run_id, "warn", "logo.fetch.write_failed", {"err": str(e)})
        raise

    # Update overrides
    ov_path = "./assets/data/og-overrides.json"
    ov = {}
    if os.path.exists(ov_path):
        try:
            with open(ov_path, "r", encoding="utf-8") as f:
                ov = json.load(f) or {}
        except Exception:
            ov = {}
    ov.setdefault("title_logo", {})
    ov.setdefault("repo_logo", {})
    rel = final_path.replace("\\", "/")
    changed = {}
    if repo:
        ov["repo_logo"][repo] = rel
        changed.setdefault("repo_logo", {})[repo] = rel
    if title:
        ov["title_logo"][title] = rel
        changed.setdefault("title_logo", {})[title] = rel
    if not (repo or title):
        # still save file; not mapped
        emit(run_id, "warn", "logo.fetch.no_mapping", {"file": rel})
    os.makedirs(os.path.dirname(ov_path), exist_ok=True)
    with open(ov_path, "w", encoding="utf-8") as f:
        json.dump(ov, f, indent=2)

    emit(run_id, "info", "logo.fetch.ok", {"file": rel, "ctype": ctype or "unknown"})
    return {"file": rel, "ctype": ctype or "unknown", "mapped": changed}


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
