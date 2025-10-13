import os
from functools import lru_cache
from typing import List

from .metrics import timer


def _have_local():
    try:
        import sentence_transformers  # noqa: F401
        return True
    except Exception:
        return False

@lru_cache(maxsize=1)
def _get_local_model():
    from sentence_transformers import SentenceTransformer
    name = os.getenv("EMBED_MODEL", "BAAI/bge-m3")
    device = os.getenv("EMBED_DEVICE", "cpu")
    return SentenceTransformer(name, device=device)

def _embed_local(texts: list[str]):
    with timer("embeddings", "local"):
        model = _get_local_model()
        return model.encode(
            texts, normalize_embeddings=True, convert_to_numpy=True, batch_size=64, show_progress_bar=False
        )

def _embed_openai(texts: list[str]):
    import numpy as np
    from openai import OpenAI
    client = OpenAI()
    model = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
    with timer("embeddings", "openai"):
        out = client.embeddings.create(model=model, input=texts)
    vecs = []
    for e in out.data:
        v = np.asarray(e.embedding, dtype="float32")
        n = float((v @ v) ** 0.5) or 1.0
        vecs.append(v / n)
    return vecs

def embed_texts(texts: list[str]):
    prefer_local = os.getenv("PREFER_LOCAL", "1").lower() in ("1", "true")
    if prefer_local and _have_local():
        try:
            return _embed_local(texts)
        except Exception as e:
            print(f"[embed] local failed, falling back to OpenAI: {e}")
    return _embed_openai(texts)

def embed_texts_openai(texts: list[str]):
    return _embed_openai(texts)
