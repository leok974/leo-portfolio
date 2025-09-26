$ErrorActionPreference = "Stop"
python -m pip install --upgrade pip
pip install -r assistant_api/requirements.in
python -m pip freeze > assistant_api/requirements.txt
pytest -q
Write-Host "✅ Deps pinned & tests green."