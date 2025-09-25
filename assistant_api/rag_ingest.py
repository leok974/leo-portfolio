import os, tempfile, subprocess, hashlib
from dotenv import load_dotenv
from .db import connect, upsert_doc, upsert_vec
from .chunkers import chunk_for_path
import numpy as np

load_dotenv()

MODEL_NAME = os.getenv("EMBED_MODEL", "intfloat/e5-large-v2")
REPOS = [r.strip() for r in os.getenv("RAG_REPOS", "").split(",") if r.strip()]

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

def file_list(repo_dir):
    for root, _, files in os.walk(repo_dir):
        for f in files:
            p = os.path.join(root, f)
            try:
                sz = os.path.getsize(p)
            except OSError:
                continue
            if sz > 0 and sz < 2_000_000:
                yield p

async def ingest():
    conn = connect()
    with tempfile.TemporaryDirectory() as tmp:
        for repo in REPOS:
            dst = os.path.join(tmp, repo.replace("/", "__"))
            subprocess.run(["git", "clone", "--depth", "1", f"https://github.com/{repo}.git", dst], check=True)
            for p in file_list(dst):
                rel = os.path.relpath(p, dst)
                try:
                    content = open(p, "r", encoding="utf-8", errors="ignore").read()
                except Exception:
                    continue
                chunks = chunk_for_path(rel, content)
                if not chunks:
                    continue
                embs = await embed(chunks)
                for i, (ck, em) in enumerate(zip(chunks, embs)):
                    did = hashlib.sha1(f"{repo}:{rel}:{i}".encode()).hexdigest()
                    upsert_doc(
                        conn,
                        {
                            "id": did,
                            "repo": repo,
                            "path": rel,
                            "sha": "head",
                            "title": rel,
                            "text": ck,
                            "meta": {"repo": repo, "path": rel, "i": i},
                        },
                    )
                    upsert_vec(conn, did, em)
            conn.commit()
