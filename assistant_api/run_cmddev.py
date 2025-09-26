import os, sys, time, asyncio
import uvicorn

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
