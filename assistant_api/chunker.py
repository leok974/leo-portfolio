import re
from collections.abc import Iterable
from typing import Dict, List, Tuple


def _split_markdown_sections(text: str) -> list[tuple[str, str]]:
    """
    Return [(heading, body)] for top-level and h2/h3 sections.
    Falls back to one chunk if no headings.
    """
    lines = text.splitlines()
    sections = []
    cur_head = "Document"
    cur_buf: list[str] = []
    heading_re = re.compile(r'^(#{1,3})\s+(.*)')

    for ln in lines:
        m = heading_re.match(ln)
        if m:
            if cur_buf:
                sections.append((cur_head, "\n".join(cur_buf).strip()))
                cur_buf = []
            cur_head = m.group(2).strip()
        else:
            cur_buf.append(ln)
    if cur_buf:
        sections.append((cur_head, "\n".join(cur_buf).strip()))
    return sections or [("Document", text)]

def chunk_markdown(text: str, max_chars: int = 3500, overlap: int = 250) -> Iterable[dict]:
    """
    Heading-aware chunks with small overlap. Returns dicts with {title, content}.
    """
    for head, body in _split_markdown_sections(text):
        if len(body) <= max_chars:
            yield {"title": head, "content": body}
            continue
        i = 0
        while i < len(body):
            j = min(i + max_chars, len(body))
            part = body[i:j]
            yield {"title": head, "content": part}
            if j == len(body):
                break
            i = max(0, j - overlap)

def html_to_text(html: str) -> str:
    """
    Best-effort HTML → text. Uses BeautifulSoup if available; falls back to tag strip.
    """
    try:
        from bs4 import BeautifulSoup  # type: ignore
        soup = BeautifulSoup(html, "html.parser")
        # remove scripts/styles
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = soup.get_text("\n", strip=True)
        # collapse blank lines
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text
    except Exception:
        # naive fallback
        txt = re.sub(r'<(script|style)[\s\S]*?>[\s\S]*?</\1>', '', html, flags=re.I)
        txt = re.sub(r'<[^>]+>', '', txt)
        txt = re.sub(r'\s+\n', '\n', txt)
        return re.sub(r'\n{3,}', '\n\n', txt).strip()
