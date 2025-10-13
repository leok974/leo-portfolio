import os
from typing import List, Tuple

from .metrics import timer


def _have_local():
    try:
        import sentence_transformers  # noqa: F401

        return True
    except Exception:
        return False


_LOCAL = None


def _get_local():
    from sentence_transformers import CrossEncoder

    name = os.getenv("RERANK_MODEL", "BAAI/bge-reranker-base")
    device = os.getenv("RERANK_DEVICE", "cpu")
    return CrossEncoder(name, device=device)


def _rerank_local(query: str, pairs: list[tuple[str, str]], topk: int):
    global _LOCAL
    if _LOCAL is None:
        _LOCAL = _get_local()
    with timer("rerank", "local"):
        scores = _LOCAL.predict([(query, t) for _, t in pairs])
    ranked = sorted(
        zip([cid for cid, _ in pairs], scores), key=lambda x: x[1], reverse=True
    )
    return ranked[:topk]


def _rerank_llm(query: str, pairs: list[tuple[str, str]], topk: int):
    import json

    from openai import OpenAI

    client = OpenAI()
    capped = pairs[: min(len(pairs), 25)]
    blocks = [f"[{i}] {text[:500]}" for i, (_, text) in enumerate(capped)]
    prompt = (
        f"Question: {query}\n\nRank the following passages by relevance. "
        f"Return a JSON array of the top {min(topk, len(capped))} indices only.\n\n"
        + "\n".join(blocks)
    )
    model = os.getenv("OPENAI_RERANK_MODEL", "gpt-4o-mini")
    with timer("rerank", "openai"):
        res = client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": prompt}]
        )
    try:
        idxs = json.loads(res.choices[0].message.content)
        idxs = [
            int(i)
            for i in idxs
            if isinstance(i, int) or (isinstance(i, str) and i.isdigit())
        ]
    except Exception:
        idxs = list(range(min(topk, len(capped))))
    ranked = [
        (capped[i][0], float(len(capped) - i)) for i in idxs if 0 <= i < len(capped)
    ]
    return ranked[:topk]


def rerank(query: str, pairs: list[tuple[str, str]], topk: int):
    prefer_local = os.getenv("PREFER_LOCAL", "1").lower() in ("1", "true")
    if prefer_local and _have_local():
        try:
            return _rerank_local(query, pairs, topk)
        except Exception as e:
            print(f"[rerank] local failed, falling back to OpenAI LLM: {e}")
    return _rerank_llm(query, pairs, topk)
