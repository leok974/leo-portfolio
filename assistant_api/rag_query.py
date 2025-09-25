import os
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from .db import connect, search
import numpy as np
from dotenv import load_dotenv

# Ensure we load env from the package-local .env (assistant_api/.env)
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

router = APIRouter()

class QueryIn(BaseModel):
    question: str
    k: int = 8

MODEL_Q = os.getenv("EMBED_MODEL_QUERY", "text-embedding-3-large")
# Normalize legacy values like 'openai/text-embedding-3-large' -> 'text-embedding-3-large'
if MODEL_Q.startswith("openai/"):
    MODEL_Q = MODEL_Q.split("/", 1)[1]
def _read_secret(env_name: str, file_env: str, default_file: str | None = None):
    val = os.getenv(env_name)
    if val:
        return val
    fpath = os.getenv(file_env) or default_file
    if fpath and Path(fpath).exists():
        try:
            return Path(fpath).read_text(encoding="utf-8").strip()
        except Exception:
            return None
    return None

OPENAI_API_KEY = _read_secret("OPENAI_API_KEY", "OPENAI_API_KEY_FILE", "/run/secrets/openai_api_key")

async def embed_query(text: str) -> np.ndarray:
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY, base_url="https://api.openai.com/v1")
    r = client.embeddings.create(model=MODEL_Q, input=[text])
    return np.array(r.data[0].embedding, dtype=np.float32)

@router.post("/rag/query")
async def rag_query(q: QueryIn):
    qv = await embed_query(q.question)
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
