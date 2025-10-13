import asyncio
import time as _time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

try:
    # Initialize uptime start timestamp early
    from .routes.status import set_start_time  # type: ignore

    set_start_time(_time.time())
except Exception:  # pragma: no cover
    pass
import os
import sys
import time

# Configurable polling (env override) for primary model detection
PRIMARY_POLL_INTERVAL_S = float(os.getenv("PRIMARY_POLL_INTERVAL_S", "5"))  # default 5s
PRIMARY_POLL_MAX_S = float(os.getenv("PRIMARY_POLL_MAX_S", "600"))  # 10 minutes


async def _poll_primary_models(
    stopper: asyncio.Event,
) -> None:  # pragma: no cover (timing heavy)
    """Background task: poll /models (primary_list_models) until model present or timeout.
    Promotes llm.path warming→primary automatically without manual refresh calls.
    Exits early when stopper is set or model detected.
    """
    start = time.perf_counter()
    try:
        from .llm_client import (
            DISABLE_PRIMARY,
            PRIMARY_MODEL,
            PRIMARY_MODEL_PRESENT,
            primary_list_models,
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
            if models and any(
                (m or "").lower().startswith((PRIMARY_MODEL or "").lower())
                for m in models
            ):
                _log(f"primary: detected model match; models_count={len(models)}")
                break
            else:
                _log(
                    f"primary: probe ok; models_count={(len(models) if models else 0)}"
                )
        except Exception as e:
            # transient errors tolerated
            _log(f"primary: probe error (tolerated): {e}")
        if (time.perf_counter() - start) > PRIMARY_POLL_MAX_S:
            break
        # Sleep/pause between polls or exit early when stopper is set
        try:
            await asyncio.wait_for(stopper.wait(), timeout=PRIMARY_POLL_INTERVAL_S)
        except TimeoutError:
            # timeout means continue polling
            pass


def _log(msg: str) -> None:
    print(f"[lifespan] {time.strftime('%H:%M:%S')} {msg}", file=sys.stderr, flush=True)


@asynccontextmanager
async def lifespan(app) -> AsyncIterator[None]:  # type: ignore[override]
    _log("startup: begin")

    # Log analytics configuration (no secrets)
    try:
        from pathlib import Path

        from .settings import get_settings

        settings = get_settings()
        geo_path = settings.get("GEOIP_DB_PATH")
        geo_exists = bool(geo_path and Path(geo_path).exists())
        _log(
            f"telemetry: dir={settings['ANALYTICS_DIR']} "
            f"retention_days={settings['ANALYTICS_RETENTION_DAYS']} "
            f"gzip_after_days={settings['ANALYTICS_GZIP_AFTER_DAYS']} "
            f"log_ip_enabled={settings['LOG_IP_ENABLED']} "
            f"geoip_db_set={bool(geo_path)} "
            f"geoip_db_exists={geo_exists} "
            f"epsilon={settings['LEARNING_EPSILON']:.3f} "
            f"decay={settings['LEARNING_DECAY']:.3f} "
            f"ema_alpha={settings['LEARNING_EMA_ALPHA']:.3f} "
            f"allow_localhost={settings.get('METRICS_ALLOW_LOCALHOST', True)}"
        )
    except Exception as exc:
        _log(f"telemetry: config check error: {exc!r}")

    stopper = asyncio.Event()
    hold_task = asyncio.create_task(_hold_open(stopper))
    poll_task: asyncio.Task | None = None
    scheduler_task: asyncio.Task | None = None

    # Optional: create analytics SQL views if persistence enabled
    try:
        from .settings import ANALYTICS_PERSIST

        if ANALYTICS_PERSIST:
            from .db import get_conn
            from .sql_views import ensure_views

            con = get_conn()
            ensure_views(con)
    except Exception:
        pass

    # SAFE_LIFESPAN: skip model probing entirely on startup (CI/dev safety)
    safe = os.getenv("SAFE_LIFESPAN", "0") in ("1", "true", "True")
    if safe:
        _log("startup: SAFE_LIFESPAN=1, skipping model probe")
    else:
        poll_task = asyncio.create_task(_poll_primary_models(stopper))

    # Start scheduler if enabled
    try:
        from .services.scheduler import scheduler_loop

        scheduler_task = asyncio.create_task(scheduler_loop())
        _log("startup: scheduler task created")
    except Exception as exc:
        _log(f"startup: scheduler initialization error: {exc!r}")

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
        if scheduler_task is not None:
            tasks.append(scheduler_task)
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
