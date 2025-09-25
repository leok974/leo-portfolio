import os
from fastapi import APIRouter
from pydantic import BaseModel
from .db import connect, search
import numpy as np
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

class QueryIn(BaseModel):
    question: str
    k: int = 8

async def _embed(q: str):
    if os.getenv("EMBED_MODEL", "").startswith("openai/"):
        from openai import OpenAI
        client = OpenAI()
        r = client.embeddings.create(model=os.environ["EMBED_MODEL"], input=[q])
        return np.array(r.data[0].embedding, dtype=np.float32)
    else:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("intfloat/e5-large-v2")
        v = model.encode([q], normalize_embeddings=True)[0]
        return np.array(v, dtype=np.float32)

@router.post("/rag/query")
async def rag_query(q: QueryIn):
    qv = await _embed(q.question)
    conn = connect()
    hits = search(conn, qv, k=q.k)
    return {
        "matches": [
            {
                "repo": h["repo"],
                "path": h["path"],
                "score": round(h["score"], 4),
                "snippet": h["text"][:500],
            }
            for h in hits
        ]
    }
