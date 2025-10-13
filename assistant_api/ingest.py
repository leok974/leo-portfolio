from __future__ import annotations

from collections.abc import Iterable
from typing import Dict

from .db import get_conn


def chunker(text: str, *, max_tokens: int = 350) -> Iterable[str]:
    """Naive line-accumulating splitter approximating ~350 tokens per part.
    Safe to swap with a semantic/token-based splitter later.
    """
    parts: list[str] = []
    buf: list[str] = []
    for line in (text or "").splitlines():
        buf.append(line)
        # Rough char->token ~ 4.5 factor; keep threshold conservative
        if sum(len(x) for x in buf) > 1600:
            parts.append("\n".join(buf))
            buf = []
    if buf:
        parts.append("\n".join(buf))
    return parts


def ingest_direct(*, project_id: str, doc_id: str, text: str, meta: dict | None = None) -> dict:
    """Write directly into chunks (and implicit FTS via triggers).

    Requires project_id and doc_id. Splits text using chunker(), writes rows with
    ordinal and meta as JSON. Returns a small summary dict.
    """
    if not project_id:
        raise ValueError("project_id is required")
    if not doc_id:
        raise ValueError("doc_id is required")
    con = get_conn()
    parts = list(chunker(text))
    meta_json = (meta and __import__("json").dumps(meta)) or "{}"
    inserted = 0
    with con:
        for i, chunk in enumerate(parts):
            # Maintain legacy 'content' while also writing to new 'text' column
            con.execute(
                "INSERT INTO chunks(content, text, project_id, doc_id, ordinal, meta) VALUES (?,?,?,?,?,json(?))",
                (chunk, chunk, project_id, doc_id, i, meta_json),
            )
            inserted += 1
        # Invalidate cached answers for this project
        try:
            con.execute("DELETE FROM answers_cache WHERE project_id = ?", (project_id,))
        except Exception:
            pass
    return {"ok": True, "inserted": inserted}


def smart_extract(path: str) -> str:
    import pathlib
    ext = pathlib.Path(path).suffix.lower()
    if ext == ".pdf":
        from pypdf import PdfReader
        r = PdfReader(path)
        return "\n\n".join((p.extract_text() or "") for p in r.pages)
    if ext in {".htm", ".html"}:
        from bs4 import BeautifulSoup
        html = pathlib.Path(path).read_text(encoding="utf-8", errors="ignore")
        soup = BeautifulSoup(html, "html.parser")
        for t in soup(["script", "style"]):
            t.extract()
        return soup.get_text("\n", strip=True)
    if ext in {".png", ".jpg", ".jpeg", ".tif", ".tiff"}:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(path))
    return pathlib.Path(path).read_text(encoding="utf-8", errors="ignore")


if __name__ == "__main__":
    import argparse
    import pathlib
    ap = argparse.ArgumentParser("assistant_api.ingest")
    ap.add_argument("--project", required=True)
    ap.add_argument("--doc-id", required=True)
    ap.add_argument("path")
    ns = ap.parse_args()
    p = pathlib.Path(ns.path)
    t = smart_extract(str(p))
    ingest_direct(project_id=ns.project, doc_id=ns.doc_id, text=t, meta={"path": str(p)})
    print("ingest: ok")
