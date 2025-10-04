Param(
  [string]$DbPath = "D:/leo-portfolio/data/rag_8010.sqlite",
  [switch]$Reset
)

$code = @"
import os, asyncio, json
from pathlib import Path
os.environ['RAG_DB'] = r'''$DbPath'''
from assistant_api.rag_ingest import ingest

req = {
  "reset": True if $([bool]$Reset) else False,
  "repos": [
    {"type":"kb","path": str(Path('data/projects.yaml').resolve())},
    {"type":"fs","path": str(Path('.').resolve()),
     "include": [
        "README.md",
        "docs/**/*.md",
        "SECURITY.md",
        "docs/DEPLOY.md",
        "docs/ARCHITECTURE.md",
        "public/**/*.html",
        "site/**/*.html",
        "docs_site/**/*.html"
      ]}
  ]
}
res = asyncio.run(ingest(req))
print(json.dumps(res, indent=2)[:2000])
"@

$python = "D:/leo-portfolio/.venv/Scripts/python.exe"
if (-not (Test-Path $python)) { throw "Python venv not found at $python" }

# Pipe the Python code to stdin (-) so it runs without temp files
$code | & $python -
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
