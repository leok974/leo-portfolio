from contextlib import asynccontextmanager
from typing import AsyncIterator
import asyncio
import time as _time
try:
    # Initialize uptime start timestamp early
    from .routes.status import set_start_time  # type: ignore
    set_start_time(_time.time())
except Exception:  # pragma: no cover
    pass
import sys
import time
import os
import logging

# Configurable polling (env override) for primary model detection
PRIMARY_POLL_INTERVAL_S = float(os.getenv("PRIMARY_POLL_INTERVAL_S", "5"))  # default 5s
PRIMARY_POLL_MAX_S = float(os.getenv("PRIMARY_POLL_MAX_S", "600"))  # 10 minutes

async def _poll_primary_models(stopper: asyncio.Event) -> None:  # pragma: no cover (timing heavy)
    """Background task: poll /models (primary_list_models) until model present or timeout.
    Promotes llm.path warming→primary automatically without manual refresh calls.
    Exits early when stopper is set or model detected.
    """
    start = time.perf_counter()
    try:
        from .llm_client import (
            primary_list_models,
            PRIMARY_MODEL,
            PRIMARY_MODEL_PRESENT,
            DISABLE_PRIMARY,
        )
    except Exception:
        return
    # Respect DISABLE_PRIMARY to avoid unnecessary probing in CI/dev
    try:
        if DISABLE_PRIMARY:
            return
    except Exception:
        pass
    while not stopper.is_set():
        # Already present? Exit.
        try:
            if PRIMARY_MODEL_PRESENT:
                break
        except Exception:
            pass
        try:
            models = await primary_list_models()
            # mark_primary_models already updates presence; ensure call occurs
            if models and any((m or '').lower().startswith((PRIMARY_MODEL or '').lower()) for m in models):
                _log(f"primary: detected model match; models_count={len(models)}")
                break
            else:
                _log(f"primary: probe ok; models_count={(len(models) if models else 0)}")
        except Exception as e:
            # transient errors tolerated
            _log(f"primary: probe error (tolerated): {e}")
        if (time.perf_counter() - start) > PRIMARY_POLL_MAX_S:
            break
        # Sleep/pause between polls or exit early when stopper is set
        try:
            await asyncio.wait_for(stopper.wait(), timeout=PRIMARY_POLL_INTERVAL_S)
        except asyncio.TimeoutError:
            # timeout means continue polling
            pass



def _log(msg: str) -> None:
    print(f"[lifespan] {time.strftime('%H:%M:%S')} {msg}", file=sys.stderr, flush=True)


@asynccontextmanager
async def lifespan(app) -> AsyncIterator[None]:  # type: ignore[override]
    _log("startup: begin")
    stopper = asyncio.Event()
    hold_task = asyncio.create_task(_hold_open(stopper))
    poll_task: asyncio.Task | None = None
    # SAFE_LIFESPAN: skip model probing entirely on startup (CI/dev safety)
    safe = os.getenv("SAFE_LIFESPAN", "0") in ("1", "true", "True")
    if safe:
        _log("startup: SAFE_LIFESPAN=1, skipping model probe")
    else:
        poll_task = asyncio.create_task(_poll_primary_models(stopper))
    try:
        _log("startup: ready (loop held)")
        yield
    finally:
        _log("shutdown: begin")
        stopper.set()
        # Cancel and gather tasks to avoid coroutine warnings/errors
        tasks: list[asyncio.Task] = [hold_task]
        if poll_task is not None:
            tasks.append(poll_task)
        for t in tasks:
            if not t.done():
                t.cancel()
        try:
            await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as exc:  # pragma: no cover - defensive logging
            _log(f"shutdown: tasks cleanup error: {exc!r}")
        _log("shutdown: done")


async def _hold_open(stopper: asyncio.Event) -> None:
    _log("hold_task: started")
    try:
        while not stopper.is_set():
            await asyncio.sleep(1.0)
    finally:
        _log("hold_task: exiting")
