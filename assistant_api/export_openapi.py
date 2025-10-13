"""Utility script to export the FastAPI OpenAPI schema to docs/openapi.json.

Usage (from repo root):
    uvicorn assistant_api.main:app --port 0  # (Only if app isn't importable; usually not needed)
    python -m assistant_api.export_openapi

This avoids needing a running server: it imports the app object and calls app.openapi().
"""

from __future__ import annotations

import json
from pathlib import Path

from .main import app  # FastAPI instance


def main() -> None:
    schema = app.openapi()
    out_path = Path(__file__).resolve().parents[1] / "docs" / "openapi.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(schema, indent=2), encoding="utf-8")
    print(f"[export_openapi] Wrote schema to {out_path}")


if __name__ == "__main__":  # pragma: no cover
    main()
