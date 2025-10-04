Param(
  [string]$DbPath = "D:/leo-portfolio/data/rag_8010.sqlite"
)

$env:RAG_DB = $DbPath
$py = "D:/leo-portfolio/.venv/Scripts/python.exe"

$code = @"
from assistant_api.fts import ensure_fts_schema, rebuild_fts, backfill_chunks_from_docs
from assistant_api.vector_store import build_index
print(ensure_fts_schema())
print(backfill_chunks_from_docs())
print(rebuild_fts())
print(build_index())
"@

# Pipe code into Python stdin (more reliable across shells)
$code | & $py -
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
