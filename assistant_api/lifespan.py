from contextlib import asynccontextmanager
from typing import AsyncIterator

from .llm_client import primary_list_models, PRIMARY_MODELS, OPENAI_MODEL as PRIMARY_MODEL_NAME
import os, asyncio, subprocess


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
            # Optional auto-pull if enabled and looks like an Ollama environment
            if os.getenv("PRIMARY_AUTO_PULL", "0").lower() in ("1","true","yes"):
                # Fire and forget: pull model asynchronously so startup isn't blocked excessively
                async def _pull():
                    cmd = ["ollama", "pull", PRIMARY_MODEL_NAME]
                    try:
                        print(f"[lifespan] auto-pull starting: {' '.join(cmd)}")
                        proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                        try:
                            await asyncio.wait_for(proc.communicate(), timeout=3600)
                        except asyncio.TimeoutError:
                            proc.kill()
                            print("[lifespan] auto-pull timeout; process killed")
                        else:
                            if proc.returncode == 0:
                                print("[lifespan] auto-pull complete; refreshing model list")
                                try:
                                    new_models = await primary_list_models()
                                    PRIMARY_MODELS[:] = new_models
                                    globals()["PRIMARY_MODEL_PRESENT"] = (
                                        PRIMARY_MODEL_NAME in new_models or any(m.lower().startswith(PRIMARY_MODEL_NAME.lower()) for m in new_models)
                                    )
                                except Exception as e:
                                    print(f"[lifespan] post-pull refresh failed: {e}")
                            else:
                                err_txt = (await proc.stderr.read()).decode(errors='ignore') if proc.stderr else ''
                                print(f"[lifespan] auto-pull failed rc={proc.returncode} {err_txt[:200]}")
                    except FileNotFoundError:
                        print("[lifespan] auto-pull skipped: 'ollama' binary not found")
                    except Exception as e:
                        print(f"[lifespan] auto-pull error: {e}")
                try:
                    asyncio.create_task(_pull())
                except RuntimeError:
                    # If no running loop, fallback to subprocess (blocking, last resort)
                    try:
                        subprocess.Popen(["ollama", "pull", PRIMARY_MODEL_NAME])
                        print("[lifespan] auto-pull spawned external process (no loop)")
                    except Exception as e:
                        print(f"[lifespan] auto-pull spawn failed: {e}")
    except Exception as e:  # pragma: no cover - defensive logging
        print(f"[lifespan] primary model warmup failed: {e}")
    try:
        yield
    finally:
        # ---- Shutdown ----
        # (No persistent resources yet; placeholder for future cleanup)
        pass
