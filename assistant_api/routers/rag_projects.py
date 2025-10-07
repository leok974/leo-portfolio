# assistant_api/routers/rag_projects.py
from __future__ import annotations
import os, json, sqlite3, datetime, re, time
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body, Depends
from pydantic import BaseModel, Field
from assistant_api.utils.auth import get_current_user

RAG_DB = os.environ.get("RAG_DB") or os.path.join(os.getcwd(), "data", "rag.sqlite")
PROJECTS_JSON = os.environ.get("PROJECTS_JSON") or os.path.join(os.getcwd(), "data", "projects_knowledge.json")

router = APIRouter(prefix="/api/rag", tags=["rag-projects"])
DEBUG_ERRORS = os.environ.get("DEBUG_ERRORS", "0") == "1"

# ---- Models
class ProjectPatch(BaseModel):
    slug: str = Field(..., description="Project slug to update")
    title: Optional[str] = None
    status: Optional[str] = Field(None, pattern=r"^(in-progress|completed)$")
    summary: Optional[str] = None
    value: Optional[str] = None
    links: Optional[Dict[str, str]] = None
    tech_stack: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    key_features: Optional[List[str]] = None

class NLUpdate(BaseModel):
    instruction: str = Field(..., description="Natural-language instruction, e.g. 'mark clarity-companion completed and add tag Accessibility' ")

# ---- SQL helpers
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  text TEXT NOT NULL,
  meta TEXT
);
"""
UPSERT_SQL = """
INSERT INTO chunks(id, project_id, text, meta)
VALUES (:id, :project_id, :text, :meta)
ON CONFLICT(id) DO UPDATE SET
  project_id=excluded.project_id,
  text=excluded.text,
  meta=excluded.meta;
"""

def _connect() -> sqlite3.Connection:
    return sqlite3.connect(RAG_DB, isolation_level=None)


def _ensure_schema(con: sqlite3.Connection):
    """Ensure chunks table has correct schema. Migrate if needed."""
    cur = con.cursor()

    # Check if chunks table exists
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chunks'")
    exists = cur.fetchone()

    if not exists:
        # Fresh DB: create schema and set user_version=1
        cur.execute(SCHEMA_SQL)
        cur.execute("PRAGMA user_version=1")
        con.commit()
        return

    # Check user_version
    cur.execute("PRAGMA user_version")
    (user_version,) = cur.fetchone()

    if user_version == 1:
        # Schema is current
        return

    # Check if schema is actually correct by verifying columns
    cur.execute("PRAGMA table_info(chunks)")
    columns = {row[1] for row in cur.fetchall()}  # row[1] is column name
    expected_columns = {"id", "project_id", "text", "meta"}

    if columns == expected_columns and user_version == 0:
        # Schema is correct but version not set - set it
        cur.execute("PRAGMA user_version=1")
        con.commit()
        return

    # Migrate: preserve old table and create fresh schema
    ts = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d%H%M%S")
    legacy = f"chunks_legacy_{ts}"
    cur.execute(f"ALTER TABLE chunks RENAME TO {legacy}")
    cur.execute(SCHEMA_SQL)
    cur.execute("PRAGMA user_version=1")
    con.commit()
    # Note: we don't auto-copy legacy rows because older schema may not map cleanly.
    # The ingest endpoints will repopulate from projects_knowledge.json.


@router.get("/projects", summary="List all projects in rag DB")
def list_projects(include_unknown: bool = False):
    """
    Return list of project_id and chunk counts.
    If include_unknown=true, also rows with NULL project_id.
    """
    con = _connect()
    try:
        cur = con.cursor()
        if include_unknown:
            rows = cur.execute("SELECT project_id, COUNT(*) as chunks FROM chunks GROUP BY project_id ORDER BY project_id").fetchall()
        else:
            rows = cur.execute("SELECT project_id, COUNT(*) as chunks FROM chunks WHERE project_id IS NOT NULL GROUP BY project_id ORDER BY project_id").fetchall()
        projects = [{"id": r[0], "chunks": r[1]} for r in rows]
        return {"ok": True, "projects": projects}
    finally:
        con.close()


def _load_projects() -> List[Dict[str, Any]]:
    with open(PROJECTS_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_projects(data: List[Dict[str, Any]]):
    with open(PROJECTS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _project_doc(p: Dict[str, Any]) -> str:
    lines = [
        f"Project: {p.get('title') or p.get('slug')}",
        f"Slug: {p.get('slug')}",
        f"Status: {p.get('status', 'in-progress')}",
        f"Summary: {p.get('summary') or ''}",
        f"Value: {p.get('value') or ''}",
        f"Tech: {', '.join(p.get('tech_stack') or [])}",
        f"Tags: {', '.join(p.get('tags') or [])}",
        f"Features: {', '.join(p.get('key_features') or [])}",
    ]
    links = p.get("links") or {}
    if links:
        lines.append("Links: " + ", ".join(f"{k}={v}" for k,v in links.items()))
    return "\n".join(lines)


def _ingest_projects(projects: List[Dict[str, Any]]) -> int:
    con = _connect()
    try:
        _ensure_schema(con)
        cur = con.cursor()
        count = 0
        for p in projects:
            pid = p["slug"]
            rid = f"project:{pid}"
            text = _project_doc(p)
            meta = json.dumps({
                "slug": p.get("slug"),
                "title": p.get("title"),
                "status": p.get("status"),
                "tags": p.get("tags"),
                "tech_stack": p.get("tech_stack"),
                "links": p.get("links"),
                "source": "projects_knowledge.json",
                # Use timezone-aware UTC to avoid deprecation warnings
                "ingested_at": datetime.datetime.now(datetime.UTC).isoformat(),
            })
            cur.execute(UPSERT_SQL, {"id": rid, "project_id": pid, "text": text, "meta": meta})
            count += 1
        con.commit()
        return count
    finally:
        con.close()


# ---- Admin guard (token or ALLOW_TOOLS=1)
def _require_admin(user=Depends(get_current_user)):
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user


def _apply_patch(patch: ProjectPatch, user: dict):
    """Apply a project patch and reingest. Used by both update and update_nl endpoints."""
    data = _load_projects()
    found = False
    for i, p in enumerate(data):
        if p.get("slug") == patch.slug:
            # merge
            upd = p.copy()
            for field in ("title","status","summary","value","links","tech_stack","tags","key_features"):
                v = getattr(patch, field)
                if v is not None:
                    upd[field] = v
            data[i] = upd
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail=f"Project not found: {patch.slug}")
    _save_projects(data)
    n = _ingest_projects(data)
    return {"ok": True, "updated": patch.slug, "reingested": n, "by": user.get("email")}


# ---- Routes
@router.post("/ingest/projects", summary="Ingest projects_knowledge.json into RAG (admin only)")
def ingest_projects(user=Depends(_require_admin)):
    try:
        data = _load_projects()
        n = _ingest_projects(data)
        return {"ok": True, "ingested": n, "by": user.get("email")}
    except Exception as e:
        if DEBUG_ERRORS:
            raise HTTPException(status_code=500, detail=f"ingest failed: {type(e).__name__}: {e}")
        raise


@router.post("/projects/update", summary="Update a project entry via structured JSON and re-ingest (admin only)")
def update_project(patch: ProjectPatch, user=Depends(_require_admin)):
    try:
        return _apply_patch(patch, user)
    except Exception as e:
        if DEBUG_ERRORS:
            raise HTTPException(status_code=500, detail=f"update failed: {type(e).__name__}: {e}")
        raise


# Simple deterministic NL → patch parser for common intents
_NL_STATUS = re.compile(r"\b(mark|set|make)\s+(?P<slug>[a-z0-9-]+)\s+(as\s+)?(?P<status>completed|in[- ]?progress)\b", re.I)
_NL_SUMMARY = re.compile(r"\bupdate\s+summary\s+for\s+(?P<slug>[a-z0-9-]+)\s+to\s+\"(?P<text>.+?)\"", re.I)
_NL_TAG_ADD = re.compile(r"\badd\s+tag\s+\"(?P<tag>[^\"]+)\"\s+to\s+(?P<slug>[a-z0-9-]+)\b", re.I)

@router.post("/projects/update_nl", summary="Natural-language update → patch + re-ingest (admin only)")
def update_project_nl(cmd: NLUpdate, user=Depends(_require_admin)):
    text = cmd.instruction.strip()
    data = _load_projects()

    m = _NL_STATUS.search(text)
    if m:
        slug = m.group("slug")
        status = m.group("status").lower().replace(" ", "-")
        patch = ProjectPatch(slug=slug, status=status)
        return _apply_patch(patch, user)

    m = _NL_SUMMARY.search(text)
    if m:
        slug, new = m.group("slug"), m.group("text")
        patch = ProjectPatch(slug=slug, summary=new)
        return _apply_patch(patch, user)

    m = _NL_TAG_ADD.search(text)
    if m:
        slug, tag = m.group("slug"), m.group("tag")
        # merge tag
        for i, p in enumerate(data):
            if p.get("slug") == slug:
                tags = list({*(p.get("tags") or []), tag})
                patch = ProjectPatch(slug=slug, tags=tags)
                return _apply_patch(patch, user)
        raise HTTPException(status_code=404, detail=f"Project not found: {slug}")

    raise HTTPException(status_code=400, detail="No supported instruction found. Try: 'mark clarity-companion completed', 'update summary for ledger-mind to \"...\"', 'add tag \"RAG\" to datapipe-ai'.")


@router.get("/diag/rag", summary="RAG diagnostics (admin only)")
def rag_diag(user=Depends(_require_admin)):
    """Read-only diagnostics for local testing and ops.
    Returns environment-derived paths and simple file stats.
    """
    cwd = os.getcwd()
    rag_db = os.environ.get("RAG_DB") or os.path.join(cwd, "data", "rag.sqlite")
    projects_json = os.environ.get("PROJECTS_JSON") or os.path.join(cwd, "data", "projects_knowledge.json")

    def fstat(p: str):
        try:
            path = Path(p)
            exists = path.exists()
            is_file = path.is_file() if exists else False
            size = path.stat().st_size if (exists and is_file) else None
            mtime = (
                time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(path.stat().st_mtime))
                if exists else None
            )
            return {
                "path": str(path),
                "exists": exists,
                "is_file": is_file,
                "size": size,
                "mtime": mtime,
            }
        except Exception as e:
            return {"path": p, "error": f"{type(e).__name__}: {e}"}

    return {
        "ok": True,
        "env": {
            "cwd": cwd,
            "RAG_DB": rag_db,
            "PROJECTS_JSON": projects_json,
            "ADMIN_TOKEN_set": bool(os.environ.get("ADMIN_TOKEN")),
            "ALLOW_TOOLS": os.environ.get("ALLOW_TOOLS", "0"),
            "DEBUG_ERRORS": os.environ.get("DEBUG_ERRORS", "0"),
            "user_version": _get_user_version(rag_db),
        },
        "files": {
            "rag_db": fstat(rag_db),
            "projects_json": fstat(projects_json),
        },
    }


def _get_user_version(db_path: str) -> int:
    try:
        con = sqlite3.connect(db_path)
        cur = con.cursor()
        cur.execute("PRAGMA user_version")
        (v,) = cur.fetchone()
        con.close()
        return int(v)
    except Exception:
        return -1


@router.post("/admin/migrate", summary="Ensure RAG schema; returns user_version (admin only)")
def rag_admin_migrate(user=Depends(_require_admin)):
    con = sqlite3.connect(RAG_DB)
    try:
        _ensure_schema(con)
        con.commit()
    finally:
        con.close()
    return {"ok": True, "user_version": _get_user_version(RAG_DB)}
