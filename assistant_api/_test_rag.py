import asyncio
import json
import os

from sentence_transformers import SentenceTransformer

from assistant_api.db import connect, search
from assistant_api.rag_query import embed_query


async def main():
    q = os.environ.get('Q', 'What does the assistant chip do?')
    if os.getenv('OPENAI_API_KEY'):
        # Use managed query embedding if configured
        qv = await embed_query(q)
    else:
        # Dev fallback: local small model
        model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        import numpy as np
        qv = np.array(model.encode([q], normalize_embeddings=True)[0], dtype=np.float32)
    conn = connect()
    hits = search(conn, qv, k=5)
    print(json.dumps([
        { 'repo':h['repo'], 'path':h['path'], 'score':round(h['score'],4)} for h in hits
    ], indent=2))

if __name__ == '__main__':
    asyncio.run(main())
