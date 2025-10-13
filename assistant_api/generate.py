SYS = "You are a concise assistant. Reply in 2–4 sentences unless asked otherwise."


async def generate_brief_answer(prompt: str) -> tuple[str, str]:
    """Return a concise answer and the provider tag ("primary"|"fallback")."""
    from .llm_client import chat as _chat

    msgs = [
        {"role": "system", "content": SYS},
        {"role": "user", "content": prompt},
    ]
    tag, resp = await _chat(msgs, stream=False)
    data = resp.json() if hasattr(resp, "json") else {}
    content = (
        (data.get("choices", [{}])[0].get("message", {}) or {}).get("content")
        or data.get("content")
        or data.get("text")
        or ""
    )
    return str(content), str(tag or "")
