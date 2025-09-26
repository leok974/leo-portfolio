import re, pathlib

def split_markdown(text: str):
    blocks = re.split(r"\n(?=#+ )", text)
    chunks = []
    for b in blocks:
        for i in range(0, len(b), 1500):
            chunks.append(b[i : i + 1500])
    return chunks

CODE_EXTS = {".ts", ".tsx", ".js", ".py", ".md", ".mdx", ".yml", ".yaml", ".json", ".html", ".css", ".sql"}

def chunk_for_path(path: str, content: str):
    ext = pathlib.Path(path).suffix.lower()
    if ext in {".md", ".mdx"}:
        return split_markdown(content)
    if ext in CODE_EXTS:
        parts = re.split(r"(?m)^(def |class |export |function )", content)
        if len(parts) > 1:
            merged = ["".join(parts[i : i + 2]) for i in range(1, len(parts), 2)]
        else:
            merged = [content]
        chunks = []
        for m in merged:
            for i in range(0, len(m), 1200):
                chunks.append(m[i : i + 1200])
        return chunks
    return [content[:2000]]
