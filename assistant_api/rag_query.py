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

MODEL_NAME = os.getenv("EMBED_MODEL", "intfloat/e5-large-v2")
_model = None

async def embed(texts):
    global _model
    if MODEL_NAME.startswith("openai/"):
        from openai import OpenAI
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])  # expects key when using OpenAI
        resp = client.embeddings.create(model=MODEL_NAME, input=texts)
        return [np.array(e.embedding, dtype=np.float32) for e in resp.data]
    else:
        if _model is None:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(MODEL_NAME)
        vecs = _model.encode(texts, normalize_embeddings=True)
        return [np.array(v, dtype=np.float32) for v in vecs]

async def _embed_one(text: str):
    vecs = await embed([text])
    return vecs[0]

@router.post("/rag/query")
async def rag_query(q: QueryIn):
    qv = await _embed_one(q.question)
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
