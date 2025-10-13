import asyncio
import os
import sys
import time
from pathlib import Path

import uvicorn

# Ensure repository root is importable so 'assistant_api' resolves when launched
# from different working directories or without PYTHONPATH.
_here = Path(__file__).resolve().parent
_repo_root = _here.parent
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

def main():
    # Force Windows selector loop (safe no-op elsewhere)
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())  # type: ignore[attr-defined]
    except Exception:
        pass

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8010"))
    app_path = os.getenv("APP_PATH", "assistant_api.main:app")

    try:
        print(f"[run_cmddev] Python: {sys.executable}")
        print(f"[run_cmddev] Repo root: {_repo_root}")
        print(f"[run_cmddev] Launching {app_path} on {host}:{port}")
        uvicorn.run(
            app_path,
            host=host,
            port=port,
            reload=False,
            workers=1,
            log_level="info",
            proxy_headers=True,
            lifespan="on",
            timeout_keep_alive=10,
            loop="asyncio",
            http="h11",
        )
    except SystemExit as e:  # surface cause when shell kills process
        print(f"[run_cmddev] uvicorn exited (SystemExit code={getattr(e,'code',None)})", file=sys.stderr)
        time.sleep(0.25)
        raise

if __name__ == "__main__":
    main()
