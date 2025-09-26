import os
import sys
from pathlib import Path
import uvicorn

# Ensure repository root (parent of this file's directory) is on sys.path so that
# "assistant_api" package resolves even if launched from a different CWD or without PYTHONPATH.
_here = Path(__file__).resolve().parent
_repo_root = _here.parent
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))


def main():
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8010"))
    # Import path kept configurable; default matches existing app
    app_path = os.getenv("APP_PATH", "assistant_api.main:app")
    uvicorn.run(
        app_path,
        host=host,
        port=port,
        reload=False,  # watchdog-based reload can be added later if needed
        workers=1,
        log_level="info",
        proxy_headers=True,
        lifespan="on",
        timeout_keep_alive=10,
    )


if __name__ == "__main__":
    main()
