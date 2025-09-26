from contextlib import asynccontextmanager
from typing import AsyncIterator
import asyncio
import sys
import time


def _log(msg: str) -> None:
    print(f"[lifespan] {time.strftime('%H:%M:%S')} {msg}", file=sys.stderr, flush=True)


@asynccontextmanager
async def lifespan(app) -> AsyncIterator[None]:  # type: ignore[override]
    _log("startup: begin")
    stopper = asyncio.Event()
    hold_task = asyncio.create_task(_hold_open(stopper))
    try:
        _log("startup: ready (loop held)")
        yield
    finally:
        _log("shutdown: begin")
        stopper.set()
        try:
            await asyncio.wait_for(hold_task, timeout=2.0)
        except Exception as exc:  # pragma: no cover - defensive logging
            _log(f"shutdown: hold_task cleanup error: {exc!r}")
        _log("shutdown: done")


async def _hold_open(stopper: asyncio.Event) -> None:
    _log("hold_task: started")
    try:
        while not stopper.is_set():
            await asyncio.sleep(1.0)
    finally:
        _log("hold_task: exiting")
