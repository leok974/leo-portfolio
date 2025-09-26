#!/usr/bin/env bash
set -euo pipefail
python -m pip install --upgrade pip
pip install -r assistant_api/requirements.in
python -m pip freeze > assistant_api/requirements.txt
pytest -q
echo "✅ Deps pinned & tests green."