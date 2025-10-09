"""
Local embedder using sentence-transformers (intfloat/e5-base-v2).

Phase 51.0 — Analytics Loop
"""
from functools import lru_cache
import numpy as np


@lru_cache(maxsize=1)
def ensure_embedder(model_name: str = "intfloat/e5-base-v2"):
    """
    Load and cache the embedding model.

    Args:
        model_name: HuggingFace model name

    Returns:
        Callable that encodes text to embeddings
    """
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(model_name)

    def encode(texts: list[str]) -> np.ndarray:
        """
        Encode texts to normalized embeddings.

        Args:
            texts: List of text strings to encode

        Returns:
            Numpy array of embeddings (normalized)
        """
        # E5 models work best with "query: " or "passage: " prefixes
        # but for simplicity we keep it plain here
        return model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False
        )

    return encode
