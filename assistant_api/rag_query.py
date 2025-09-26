import os, numpy as np
from fastapi import APIRouter, HTTPException
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

async def embed_query_matching_dim(text: str, dim: int | None) -> np.ndarray:
    # If index empty, default to OpenAI small (1536) so future index stays consistent if ingested that way.
    if dim in (1536, 3072, None):
        api_key = _read_openai_key()
        if not api_key:
            # If OpenAI key missing but index expects OpenAI dims, signal service unavailable
            raise HTTPException(status_code=503, detail="Embeddings key missing for OpenAI (required for current index)")
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        model = "text-embedding-3-small" if dim in (1536, None) else "text-embedding-3-large"
        r = client.embeddings.create(model=model, input=[text])
        return np.array(r.data[0].embedding, dtype=np.float32)
    elif dim in (384, 768):
        # Use local SentenceTransformers models to match ingest
        from sentence_transformers import SentenceTransformer
        model_id = "intfloat/e5-small-v2" if dim == 384 else "intfloat/e5-base-v2"
        model = SentenceTransformer(model_id)
        vec = model.encode([text], normalize_embeddings=True)[0]
        return np.array(vec, dtype=np.float32)
    else:
        raise HTTPException(status_code=500, detail=f"Unsupported index dimension: {dim}")

@router.post("/rag/query")
async def rag_query(q: QueryIn):
    conn = connect()
    dim = index_dim(conn)
    qv = await embed_query_matching_dim(q.question, dim)
    hits = search(conn, qv, k=q.k)
    return {"matches": [
        {"repo": h["repo"], "path": h["path"], "score": round(h["score"], 4), "snippet": h["text"][:600]}
        for h in hits
    ]}
