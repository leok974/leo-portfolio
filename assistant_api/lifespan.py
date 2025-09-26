from contextlib import asynccontextmanager
from typing import AsyncIterator

from .llm_client import primary_list_models, PRIMARY_MODELS, OPENAI_MODEL as PRIMARY_MODEL_NAME


@asynccontextmanager
async def lifespan(app) -> AsyncIterator[None]:  # type: ignore[override]
    """Application lifespan context.

    Startup tasks:
      - Populate PRIMARY_MODELS cache
      - Determine PRIMARY_MODEL_PRESENT flag

    Shutdown tasks: (placeholder for future resource cleanup)
      - Close model / HTTP clients if persistent
    """
    # ---- Startup ----
    try:
        models = await primary_list_models()
        PRIMARY_MODELS[:] = models
        present = PRIMARY_MODEL_NAME in models or any(
            m.lower().startswith(PRIMARY_MODEL_NAME.lower()) for m in models
        )
        globals()["PRIMARY_MODEL_PRESENT"] = present
        if not present:
            print(f"[lifespan] WARNING primary model '{PRIMARY_MODEL_NAME}' not found in {len(models)} models")
    except Exception as e:  # pragma: no cover - defensive logging
        print(f"[lifespan] primary model warmup failed: {e}")
    try:
        yield
    finally:
        # ---- Shutdown ----
        # (No persistent resources yet; placeholder for future cleanup)
        pass
