from typing import Dict, Callable, Any, List, Tuple
import os, json, subprocess, shutil, re, io, urllib.request, urllib.error, socket, ipaddress, hashlib
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


@task("media.scan")
def media_scan(run_id, params):
    """
    Scan media under ./public and ./assets and write assets/data/media-index.json.
    Records: path, bytes, width/height (if available), ext, sha1 (first 32 hex), mtime.
    """
    roots = ["./public", "./assets"]
    exts = {".png",".jpg",".jpeg",".webp",".gif",".svg",".bmp",".tiff"}
    items: List[Dict[str, Any]] = []
    have_pil = False
    try:
        from PIL import Image  # type: ignore
        have_pil = True
    except Exception:
        pass

    def get_dims(p: str, ext: str) -> Tuple[int,int]:
        if ext == ".svg":
            try:
                txt = open(p,"r",encoding="utf-8",errors="ignore").read()
                m = re.search(r'\bwidth="?(\d+)', txt) and re.search(r'\bheight="?(\d+)', txt)
            except Exception:
                m=None
            if m:
                w = int(re.search(r'\bwidth="?(\d+)', txt).group(1))
                h = int(re.search(r'\bheight="?(\d+)', txt).group(1))
                return w,h
            return (0,0)
        if have_pil:
            try:
                from PIL import Image  # type: ignore
                with Image.open(p) as im:
                    return int(im.width), int(im.height)
            except Exception:
                return (0,0)
        return (0,0)

    for root in roots:
        if not os.path.isdir(root):
            continue
        for r,_,files in os.walk(root):
            for fn in files:
                ext = os.path.splitext(fn)[1].lower()
                if ext not in exts: continue
                path = os.path.join(r,fn)
                try:
                    st = os.stat(path)
                except FileNotFoundError:
                    continue
                w,h = get_dims(path, ext)
                rel = path.replace("\\","/")
                sha1 = ""
                try:
                    with open(path,"rb") as f:
                        sha1 = hashlib.sha1(f.read(65536)).hexdigest()[:32]
                except Exception:
                    pass
                items.append({
                    "path": rel,
                    "bytes": int(st.st_size),
                    "width": w, "height": h,
                    "ext": ext[1:],
                    "sha1": sha1,
                    "mtime": int(st.st_mtime),
                })
    items.sort(key=lambda x: (-x["bytes"], x["path"]))
    dst = "./assets/data/media-index.json"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst,"w",encoding="utf-8") as f:
        json.dump({"count": len(items), "items": items}, f, indent=2)
    emit(run_id, "info", "media.scan.ok", {"count": len(items)})
    return {"file": dst, "count": len(items)}


@task("media.optimize")
def media_optimize(run_id, params):
    """
    Create WebP + thumbnails (480w, 960w) into ./assets/derived/.
    Skips SVG/GIF; requires Pillow. Respects params: {quality:int=82, limit:int (max files), overwrite:bool=False}
    """
    try:
        from PIL import Image  # type: ignore
    except Exception:
        emit(run_id, "warn", "media.optimize.pillow_missing", {})
        return {"skipped": True, "reason": "pillow_missing"}
    idx_path = "./assets/data/media-index.json"
    if not os.path.exists(idx_path):
        emit(run_id, "warn", "media.optimize.no_index", {})
        return {"skipped": True, "reason": "no_index"}
    idx = json.loads(open(idx_path,"r",encoding="utf-8").read())
    items = idx.get("items", [])
    outdir = "./assets/derived"
    os.makedirs(outdir, exist_ok=True)
    q = int(params.get("quality") or 82)
    limit = int(params.get("limit") or 1000)
    overwrite = bool(params.get("overwrite") or False)
    done = 0
    made = []
    for it in items:
        if done >= limit: break
        ext = it.get("ext","").lower()
        if ext in {"svg","gif"}: continue
        p = it.get("path","")
        if not p or not os.path.exists(p): continue
        base, _ = os.path.splitext(os.path.basename(p))
        target_webp = os.path.join(outdir, base + ".webp")
        thumb_480 = os.path.join(outdir, base + ".480w.webp")
        thumb_960 = os.path.join(outdir, base + ".960w.webp")
        if not overwrite and all(os.path.exists(x) for x in [target_webp, thumb_480, thumb_960]):
            continue
        try:
            with Image.open(p) as im:
                im = im.convert("RGB")
                # main webp
                if overwrite or not os.path.exists(target_webp):
                    im.save(target_webp, "WEBP", quality=q, method=6)
                    made.append(target_webp.replace("\\","/"))
                # thumbs
                for size, dest in [(480, thumb_480), (960, thumb_960)]:
                    if overwrite or not os.path.exists(dest):
                        rim = im.copy()
                        rim.thumbnail((size, size*10_000), Image.LANCZOS)
                        rim.save(dest, "WEBP", quality=q, method=6)
                        made.append(dest.replace("\\","/"))
                done += 1
        except Exception as e:
            emit(run_id, "warn", "media.optimize.fail", {"path": p, "err": str(e)})
    emit(run_id, "info", "media.optimize.ok", {"files": len(made)})
    return {"files": len(made), "outdir": outdir}


@task("links.suggest")
def links_suggest(run_id, params):
    """
    Generate suggestions for missing local links using fuzzy filename matching.
    Input: assets/data/link-check.json
    Output: assets/data/link-suggest.json with {missing_url: [suggested_paths...]}
    """
    lc = "./assets/data/link-check.json"
    if not os.path.exists(lc):
        emit(run_id, "warn", "links.suggest.no_report", {})
        return {"skipped": True}
    data = json.loads(open(lc,"r",encoding="utf-8").read())
    missing = [m["url"] for m in data.get("missing", []) if isinstance(m.get("url"), str)]
    # candidate corpus: all local files
    corpus: List[str] = []
    for root in ["./public","./assets"]:
        if not os.path.isdir(root): continue
        for r,_,files in os.walk(root):
            for fn in files:
                corpus.append(os.path.join(r,fn).replace("\\","/"))
    import difflib
    def base(u: str) -> str:
        u = u.split("#",1)[0].split("?",1)[0]
        return os.path.basename(u)
    suggestions: Dict[str, List[str]] = {}
    for miss in missing:
        b = base(miss)
        if not b: continue
        # quick extension-aware filter
        ext = os.path.splitext(b)[1].lower()
        candidates = [c for c in corpus if (not ext or c.lower().endswith(ext))]
        # fuzzy match by filename
        names = [os.path.basename(c) for c in candidates]
        scored = difflib.get_close_matches(b, names, n=5, cutoff=0.6)
        picks = []
        for s in scored:
            for c in candidates:
                if os.path.basename(c) == s:
                    picks.append(c)
                    break
        if picks:
            suggestions[miss] = picks[:5]
    out = {"count": len(suggestions), "suggestions": suggestions}
    dst = "./assets/data/link-suggest.json"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst,"w",encoding="utf-8") as f:
        json.dump(out,f,indent=2)
    emit(run_id, "info", "links.suggest.ok", {"count": out["count"]})
    return {"file": dst, "count": out["count"]}


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


@task("layout.optimize")
def layout_optimize(run_id, params):
    """
    Optimize project layout ordering based on freshness, signal, fit, and media quality.
    Generates assets/layout.json with prioritized project order.

    Params:
        roles: List of target roles (e.g., ["ai", "swe", "ml"])
    """
    from ..services.layout_opt import run_layout_optimize

    emit(run_id, "info", "layout.optimize.start", {"params": params})
    try:
        result = run_layout_optimize(params)
        emit(run_id, "info", "layout.optimize.done", {"summary": result.get("summary")})
        return result
    except Exception as e:
        emit(run_id, "error", "layout.optimize.failed", {"error": str(e)})
        raise


@task("seo.tune")
def seo_tune(run_id, params):
    """
    Analyze CTR data and generate SEO metadata improvements.
    Creates seo-tune.json and seo-tune.md artifacts with recommended title/description changes.

    Params:
        threshold: CTR threshold (default from settings)

    Note: Auto-downgrades to mock when SEO_LLM_ENABLED=0 for seamless local/CI testing.
    """
    from ..settings import get_settings
    settings = get_settings()

    # Auto-downgrade to mock when LLM disabled
    if not settings.get("SEO_LLM_ENABLED"):
        emit(run_id, "info", "seo.tune.auto_mock", {"reason": "SEO_LLM_ENABLED=0"})
        from ..routers.agent_run_mock import run_mock_plan, require_cf_access
        # Use mock implementation (will write deterministic artifacts)
        try:
            result = run_mock_plan(body=params, principal="agent-task")
            emit(run_id, "info", "seo.tune.mock_done", {"count": result.get("count")})
            return result
        except Exception as e:
            emit(run_id, "error", "seo.tune.mock_failed", {"error": str(e)})
            raise

    # Full LLM path
    from ..tasks.seo_tune import run as run_seo_tune

    emit(run_id, "info", "seo.tune.start", {"params": params})
    try:
        threshold = params.get("threshold") if params else None
        result = run_seo_tune(threshold=threshold)
        emit(run_id, "info", "seo.tune.done", {"count": result.get("count")})
        return result
    except Exception as e:
        emit(run_id, "error", "seo.tune.failed", {"error": str(e)})
        raise
