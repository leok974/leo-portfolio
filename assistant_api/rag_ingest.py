import fnmatch
import glob
import hashlib
import json
import os
import sqlite3
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from dotenv import load_dotenv

from .chunker import chunk_markdown, html_to_text
from .chunkers import chunk_for_path
from .db import DB_PATH, commit_with_retry, connect, upsert_doc, upsert_vec

try:
    import yaml  # type: ignore
except Exception:
    yaml = None

# Ensure we load env from the package-local .env (assistant_api/.env)
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

_model = None
MODEL_I = "intfloat/e5-base-v2"

def _hash_embed(texts: list[str], dim: int = 256):
    def one(t: str) -> np.ndarray:
        v = np.zeros(dim, dtype=np.float32)
        for tok in (t or "").lower().split():
            d = hashlib.blake2b(tok.encode("utf-8"), digest_size=8).digest()
            idx = int.from_bytes(d, "big") % dim
            v[idx] += 1.0
        n = np.linalg.norm(v) or 1.0
        v /= n
        return v
    return [one(t) for t in texts]

async def embed(texts: list[str]):
    """Prefer local SentenceTransformer; fallback to deterministic hash embedding."""
    global _model
    try:
        if _model is None:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(MODEL_I)
        vecs = _model.encode(texts, normalize_embeddings=True)
        return [np.array(v, dtype=np.float32) for v in vecs]
    except Exception:
        return _hash_embed(texts)

def file_list(repo_dir):
    for root, _, files in os.walk(repo_dir):
        for f in files:
            p = os.path.join(root, f)
            try:
                sz = os.path.getsize(p)
            except OSError:
                continue
            if sz > 0 and sz < 2_000_000:
                yield p

def _reset_index():
    # Remove DB file to clear incompatible schemas/dimensions
    try:
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
    except Exception:
        pass

def _collect_fs_files(base: str, includes: list[str]) -> list[str]:
    files: list[str] = []
    for pat in includes or ["**/*.md", "README.md"]:
        for p in glob.glob(os.path.join(base, pat), recursive=True):
            try:
                if os.path.isfile(p) and os.path.getsize(p) > 0:
                    files.append(os.path.abspath(p))
            except Exception:
                continue
    # De-dup while keeping order
    seen = set()
    out: list[str] = []
    for p in files:
        if p not in seen:
            seen.add(p); out.append(p)
    return out

def _open_db(path: str):
    con = sqlite3.connect(path, timeout=30.0, check_same_thread=False)
    try:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA synchronous=NORMAL")
        con.execute("PRAGMA busy_timeout=10000")
    except Exception:
        pass
    return con

def _ensure_kb_schema(con: sqlite3.Connection):
    con.execute(
        """
      CREATE TABLE IF NOT EXISTS kb_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        one_liner TEXT,
        stack TEXT,
        highlights TEXT,
        links TEXT,
        tags TEXT,
        paths TEXT,
        updated_at REAL
      )
    """
    )
    commit_with_retry(con, retries=6)

def _load_projects_yaml(path: str) -> list[dict[str, Any]]:
    if not os.path.exists(path):
        return []
    if yaml is None:
        raise RuntimeError("PyYAML not installed. `pip install pyyaml` to use projects.yaml")
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or []
    out: list[dict[str, Any]] = []
    for p in data:
        out.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "one_liner": p.get("one_liner"),
            "stack": json.dumps(p.get("stack", []), ensure_ascii=False),
            "highlights": json.dumps(p.get("highlights", []), ensure_ascii=False),
            "links": json.dumps(p.get("links", {}), ensure_ascii=False),
            "tags": json.dumps(p.get("tags", []), ensure_ascii=False),
            "paths": json.dumps(p.get("paths", []), ensure_ascii=False),
        })
    return out

def _upsert_kb_projects(con: sqlite3.Connection, projects: list[dict[str, Any]]):
    if not projects:
        return
    try:
        _ensure_kb_schema(con)
        now = time.time()
        for p in projects:
            con.execute(
                """
          INSERT INTO kb_projects(id, name, one_liner, stack, highlights, links, tags, paths, updated_at)
          VALUES(?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            one_liner=excluded.one_liner,
            stack=excluded.stack,
            highlights=excluded.highlights,
            links=excluded.links,
            tags=excluded.tags,
            paths=excluded.paths,
            updated_at=excluded.updated_at
        """,
                (p["id"], p["name"], p["one_liner"], p["stack"], p["highlights"], p["links"], p["tags"], p["paths"], now),
            )
        commit_with_retry(con, retries=6)
    finally:
        try:
            con.close()
        except Exception:
            pass

def _match_project_id(projects: list[dict[str, Any]], file_path: str) -> str:
    norm = file_path.replace("\\", "/").lower()
    for pd in projects:
        try:
            globs = json.loads(pd.get("paths") or "[]")
        except Exception:
            globs = []
        for pattern in globs:
            try:
                if fnmatch.fnmatch(norm, pattern.lower()):
                    return pd.get("id") or ""
            except Exception:
                continue
    return ""

async def ingest(req: dict | None = None):
    """Flexible ingest.

    req schema:
    {
      "reset": bool,
      "dry_run": bool,
      "repos": [
        {"type":"fs","path":".","include":["README.md","docs/**/*.md"]} |
        {"type":"git","url":"https://...","ref":"main","include":[...]}]
    }
    If req is None, falls back to env RAG_REPOS (git shorthand: owner/repo).
    """
    if req is None:
        req = {}
    reset = bool(req.get("reset", False))
    dry_run = bool(req.get("dry_run", False))
    repos = req.get("repos") or []
    if reset:
        _reset_index()

    if dry_run:
        preview: list[dict] = []
        for r in repos:
            if (r or {}).get("type") == "fs":
                base = os.path.abspath(r.get("path") or ".")
                includes = r.get("include") or []
                files = _collect_fs_files(base, includes)
                preview.append({"type": "fs", "path": base, "files": [os.path.relpath(f, base) for f in files]})
            elif (r or {}).get("type") == "git":
                preview.append({"type": "git", "url": r.get("url"), "ref": r.get("ref", "HEAD")})
        return {"ok": True, "dry_run": True, "preview": preview}

    conn = connect()
    total_chunks = 0
    used = []
    try:
        # If no repos provided, use RAG_REPOS (git shorthand)
        if not repos:
            env_repos = [r.strip() for r in os.getenv("RAG_REPOS", "").split(",") if r.strip()]
            for repo in env_repos:
                with tempfile.TemporaryDirectory() as tmp:
                    dst = os.path.join(tmp, repo.replace("/", "__"))
                    subprocess.run(["git", "clone", "--depth", "1", f"https://github.com/{repo}.git", dst], check=True)
                    for p in file_list(dst):
                        rel = os.path.relpath(p, dst)
                        try:
                            content = open(p, encoding="utf-8", errors="ignore").read()
                        except Exception:
                            continue
                        chunks = chunk_for_path(rel, content) or []
                        if not chunks:
                            continue
                        embs = await embed(chunks)
                        for i, (ck, em) in enumerate(zip(chunks, embs)):
                            did = hashlib.sha1(f"{repo}:{rel}:{i}".encode()).hexdigest()
                            upsert_doc(conn, {"id": did, "repo": repo, "path": rel, "sha": "head", "title": rel, "text": ck, "meta": {"repo": repo, "path": rel, "i": i}})
                            upsert_vec(conn, did, em)
                            total_chunks += 1
                    used.append({"type": "git", "repo": repo})
            commit_with_retry(conn, retries=6)
            return {"ok": True, "chunks": total_chunks, "sources": used}

        # Structured repos: kb, fs or git
        with tempfile.TemporaryDirectory() as tmp:
            kb_projects: list[dict[str, Any]] = []
            for r in repos:
                rtype = (r or {}).get("type", "fs")
                if rtype == "kb":
                    # Load structured KB definitions and optionally persist to DB
                    try:
                        kb_projects = _load_projects_yaml(r.get("path") or "data/projects.yaml")
                        used.append({"type": "kb", "path": r.get("path"), "count": len(kb_projects)})
                        try:
                            _upsert_kb_projects(_open_db(DB_PATH), kb_projects)
                        except Exception:
                            pass
                    except Exception as e:
                        used.append({"type": "kb", "path": r.get("path"), "error": str(e)})
                    continue
                if rtype == "fs":
                    base = os.path.abspath(r.get("path") or ".")
                    includes = r.get("include") or ["README.md", "docs/**/*.md", "SECURITY.md", "docs/DEPLOY.md", "docs/ARCHITECTURE.md"]
                    files = _collect_fs_files(base, includes)
                    for fp in files:
                        rel = os.path.relpath(fp, base)
                        try:
                            content = open(fp, encoding="utf-8", errors="ignore").read()
                        except Exception:
                            continue
                        # Enhanced chunking and titles
                        ext = os.path.splitext(fp)[1].lower()
                        if ext in (".md", ".mdx"):
                            chunk_objs = list(chunk_markdown(content))
                        elif ext in (".html", ".htm"):
                            txt = html_to_text(content)
                            chunk_objs = list(chunk_markdown(txt))
                        else:
                            parts_fallback = chunk_for_path(rel, content) or []
                            chunk_objs = [{"title": rel, "content": ck} for ck in parts_fallback]
                        if not chunk_objs:
                            continue
                        parts = [c.get("content", "") for c in chunk_objs]
                        titles = [c.get("title") or rel for c in chunk_objs]
                        embs = await embed(parts)
                        # Optional project tagging based on KB patterns
                        project_id = _match_project_id(kb_projects, rel) if kb_projects else ""
                        for i, (ck, em, ttl) in enumerate(zip(parts, embs, titles)):
                            did = hashlib.sha1(f"fs:{base}:{rel}:{i}".encode()).hexdigest()
                            meta = {"path": rel, "base": base, "i": i}
                            if project_id:
                                meta["project_id"] = project_id
                            upsert_doc(conn, {"id": did, "repo": "local-fs", "path": rel, "sha": "fs", "title": ttl, "text": ck, "meta": meta})
                            upsert_vec(conn, did, em)
                            total_chunks += 1
                    used.append({"type": "fs", "path": base, "count": len(files)})
                elif rtype == "git":
                    url = r.get("url"); ref = r.get("ref") or "HEAD"
                    if not url:
                        continue
                    dst = os.path.join(tmp, hashlib.sha1(url.encode()).hexdigest()[:8])
                    try:
                        subprocess.run(["git", "clone", "--depth", "1", url, dst], check=True)
                        if ref and ref not in ("HEAD", "head"):
                            subprocess.run(["git", "-C", dst, "checkout", ref], check=True)
                    except Exception as e:
                        used.append({"type": "git", "url": url, "ref": ref, "error": str(e)})
                        continue
                    includes = r.get("include") or ["**/*.md"]
                    files = _collect_fs_files(dst, includes)
                    for fp in files:
                        rel = os.path.relpath(fp, dst)
                        try:
                            content = open(fp, encoding="utf-8", errors="ignore").read()
                        except Exception:
                            continue
                        chunks = chunk_for_path(rel, content) or []
                        if not chunks:
                            continue
                        embs = await embed(chunks)
                        for i, (ck, em) in enumerate(zip(chunks, embs)):
                            did = hashlib.sha1(f"git:{url}:{rel}:{i}".encode()).hexdigest()
                            upsert_doc(conn, {"id": did, "repo": url, "path": rel, "sha": ref, "title": rel, "text": ck, "meta": {"url": url, "path": rel, "i": i}})
                            upsert_vec(conn, did, em)
                            total_chunks += 1
                    used.append({"type": "git", "url": url, "ref": ref, "count": len(files)})
            commit_with_retry(conn, retries=6)
        return {"ok": True, "chunks": total_chunks, "sources": used}
    finally:
        try:
            conn.close()
        except Exception:
            pass
