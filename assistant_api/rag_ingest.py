import os, tempfile, subprocess, hashlib
from pathlib import Path
from dotenv import load_dotenv
from .db import connect, upsert_doc, upsert_vec
from .chunkers import chunk_for_path
import numpy as np

# Ensure we load env from the package-local .env (assistant_api/.env)
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

_model = None
MODEL_I = "intfloat/e5-base-v2"

async def embed(texts):
    global _model
    # Always use local SentenceTransformer for ingest
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(MODEL_I)
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
        # Read repos from env at call time
        repos = [r.strip() for r in os.getenv("RAG_REPOS", "").split(",") if r.strip()]
        for repo in repos:
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
