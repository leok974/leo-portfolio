import os, numpy as np, hashlib
from fastapi import APIRouter
from pydantic import BaseModel
from .db import connect, search, index_dim

router = APIRouter()

class QueryIn(BaseModel):
    question: str
    k: int = 8

# Auto-match the query embedder to the stored index dimension

def _read_openai_key() -> str | None:
    key = os.getenv("OPENAI_API_KEY")
    if key:
        return key
    p = os.getenv("OPENAI_API_KEY_FILE", "/run/secrets/openai_api_key")
    if os.path.exists(p):
        try:
            return open(p, "r", encoding="utf-8").read().strip()
        except Exception:
            return None
    return None


def _hash_embed(text: str, dim: int | None) -> np.ndarray:
    size = dim if isinstance(dim, int) and dim > 0 else 256
    vec = np.zeros(size, dtype=np.float32)
    for token in text.lower().split():
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        idx = int.from_bytes(digest, "big") % size
        vec[idx] += 1.0
    norm = np.linalg.norm(vec) or 1.0
    vec /= norm
    return vec


async def embed_query_matching_dim(text: str, dim: int | None) -> tuple[np.ndarray, str]:
    if dim in (1536, 3072, None):
        api_key = _read_openai_key()
        if not api_key:
            return _hash_embed(text, dim), "local-fallback"
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        model = "text-embedding-3-small" if dim in (1536, None) else "text-embedding-3-large"
        try:
            r = client.embeddings.create(model=model, input=[text])
            vec = np.array(r.data[0].embedding, dtype=np.float32)
            return vec, "openai"
        except Exception:
            return _hash_embed(text, dim), "local-fallback"
    elif dim in (384, 768):
        from sentence_transformers import SentenceTransformer
        model_id = "intfloat/e5-small-v2" if dim == 384 else "intfloat/e5-base-v2"
        model = SentenceTransformer(model_id)
        vec = model.encode([text], normalize_embeddings=True)[0]
        return np.array(vec, dtype=np.float32), "local-model"
    else:
        return _hash_embed(text, dim), "local-fallback"


@router.post("/rag/query")
async def rag_query(q: QueryIn):
    conn = connect()
    dim = index_dim(conn)
    qv, mode = await embed_query_matching_dim(q.question, dim)
    hits = search(conn, qv, k=q.k)
    return {
        "matches": [
            {"repo": h["repo"], "path": h["path"], "score": round(h["score"], 4), "snippet": h["text"][:600]}
            for h in hits
        ],
        "mode": mode,
    }
