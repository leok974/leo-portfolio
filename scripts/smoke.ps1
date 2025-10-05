param(
  [string]$Base="http://127.0.0.1:8023",
  [string]$Db = "$env:RAG_DB"
)

Write-Host "[smoke] DB=$Db Base=$Base"
# Batch ingest a tiny folder if present
if (Test-Path .\docs) {
  python -m assistant_api.cli ingest --batch .\docs --project demo | Out-Null
}
# Rebuild FTS
python -m assistant_api.cli rebuild-index | Out-Null
# Ready
try { Invoke-RestMethod "$Base/api/ready" | Out-Null; Write-Host "[ok] ready" } catch { throw }
# Projects perf (10 calls)
$times = @()
1..10 | ForEach-Object {
  $t = Measure-Command { Invoke-RestMethod "$Base/api/rag/projects" | Out-Null }
  $times += $t.TotalMilliseconds
}
$sorted = $times | Sort-Object
$p95 = $sorted[[math]::Max([int]([math]::Ceiling($sorted.Count * 0.95))-1,0)]
Write-Host "[perf] /api/rag/projects p95 = $([math]::Round($p95,2)) ms"
# Query demo
$body = @{ question="ledger reconciliation"; } | ConvertTo-Json
$r = Invoke-RestMethod -Method POST "$Base/api/rag/query?project_id=demo&limit=10&offset=0" -ContentType "application/json" -Body $body
Write-Host "[hits]" $r.hits.Length "cache=" $r.cache "elapsed_ms=" $r.meta.elapsed_ms

