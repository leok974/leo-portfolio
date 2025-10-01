import re, os, httpx

RAG_URL = os.getenv("RAG_URL", "http://127.0.0.1:8001/api/rag/query")
PROJECT_HINTS = [
    r"\bledgermind\b", r"\bportfolio\b", r"\bassistant chip\b",
    r"\brag\b", r"\bfastapi\b", r"\brelay\b"
]

def needs_repo_context(user_text: str) -> bool:
    t = (user_text or "").lower()
    return any(re.search(p, t) for p in PROJECT_HINTS) or ("repo" in t) or ("code" in t)

async def fetch_context(question: str, k=6):
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(RAG_URL, json={"question": question, "k": k})
        r.raise_for_status()
        return (r.json() or {}).get("matches", [])[:k]

def build_context_message(matches):
    cites = [f"- {m['repo']}/{m['path']}" for m in matches]
    snippets = "\n\n".join([m.get("snippet", "") for m in matches])
    content = (
        "Use the following repo snippets to answer precisely. "
        "Cite file paths inline like [repo/path].\n\n" \
        + "Sources:\n" + "\n".join(cites) + "\n\nSnippets:\n" + snippets
    )
    return {"role": "system", "content": content}
