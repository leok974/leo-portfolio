# assistant_api/tasks/seo_tune.py
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timezone
from typing import Dict

from ..ctr_analytics.storage import ensure_tables, fetch_below_ctr
from ..settings import get_settings
from ..utils.artifacts import ensure_artifacts_dir, write_artifact


@dataclass
class PageMeta:
    title: str | None
    description: str | None


TITLE_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
DESC_RE = re.compile(
    r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']',
    re.IGNORECASE | re.DOTALL,
)


def extract_meta_from_html(html: str) -> PageMeta:
    t = TITLE_RE.search(html)
    d = DESC_RE.search(html)
    return PageMeta(
        title=(t.group(1).strip() if t else None),
        description=(d.group(1).strip() if d else None),
    )


def load_current_meta(url_path: str, web_root: str) -> PageMeta:
    """
    Best-effort: resolve /projects/x → <root>/projects/x.html; "/" -> index.html
    """
    if url_path.endswith("/"):
        url_path += "index.html"
    if not url_path.endswith(".html"):
        url_path += ".html"
    file_path = os.path.join(web_root.lstrip("/"), url_path.lstrip("/"))
    if not os.path.exists(file_path):
        return PageMeta(title=None, description=None)
    with open(file_path, encoding="utf-8", errors="ignore") as f:
        html = f.read()
    return extract_meta_from_html(html)


def heuristic_rewrite(meta: PageMeta, url: str, target_ctr: float) -> PageMeta:
    """
    Cheap, deterministic rewrite when LLM not invoked.
    - Adds action verb + value prop to title if short/bland
    - Tightens description with benefit + specificity
    """
    title = meta.title or "Untitled"
    desc = meta.description or ""

    if len(title) < 40:
        title = f"Boost Results with {title}".strip()
    if "AI" not in title and "Agent" not in title and "Automation" not in title:
        title = title + " — AI Automation"

    if len(desc) < 80:
        desc = (
            desc
            + " Fast load, clear value, and real outcomes. Learn how this project improves workflow and reliability."
        ).strip()

    # minimal clipping
    title = title[:70]
    desc = desc[:155]
    return PageMeta(title=title, description=desc)


def run(threshold: float | None = None) -> dict:
    settings = get_settings()
    db_path = settings["RAG_DB"]
    ensure_tables(db_path)

    th = float(threshold or settings["SEO_CTR_THRESHOLD"])
    rows = fetch_below_ctr(db_path, th)

    web_root = (
        settings["WEB_ROOT"] or "."
    )  # point to built HTML (e.g., apps/web/dist or repo root)
    ensure_artifacts_dir(settings["ARTIFACTS_DIR"])

    pages = []
    for r in rows:
        cur = load_current_meta(r.url, settings["WEB_ROOT"])

        # Try LLM first (if enabled); fallback to heuristic if unavailable/malformed
        new = None
        method = "heuristic"
        try:
            if bool(settings.get("SEO_LLM_ENABLED", True)):
                from ..llm.seo_rewriter import llm_rewrite

                new = llm_rewrite(r.url, r.ctr, cur)
                if new:
                    method = "llm"
        except Exception:
            new = None

        if not new:
            new = heuristic_rewrite(cur, r.url, r.ctr)
            method = "heuristic"

        pages.append(
            {
                "url": r.url,
                "ctr": r.ctr,
                "old_title": cur.title,
                "old_description": cur.description,
                "new_title": new.title,
                "new_description": new.description,
                "notes": method,
            }
        )

    out_json = {
        "generated": datetime.now(UTC).isoformat(),
        "threshold": th,
        "count": len(pages),
        "pages": pages,
    }
    json_path = write_artifact(
        settings["ARTIFACTS_DIR"],
        "seo-tune.json",
        json.dumps(out_json, ensure_ascii=False, indent=2),
    )

    # minimal MD
    lines = [
        "# SEO Tune Report",
        "",
        f"- Generated: {out_json['generated']}",
        f"- Threshold: {th}",
        f"- Pages: {len(pages)}",
        "",
    ]
    for p in pages[:200]:
        lines += [
            f"## {p['url']}  (ctr={p['ctr']:.4f})",
            f"**Old title:** {p['old_title'] or '—'}",
            f"**New title:** {p['new_title']}",
            f"**Old description:** {p['old_description'] or '—'}",
            f"**New description:** {p['new_description']}",
            "",
        ]
    md_path = write_artifact(settings["ARTIFACTS_DIR"], "seo-tune.md", "\n".join(lines))

    return {"ok": True, "json": json_path, "md": md_path, "count": len(pages)}
