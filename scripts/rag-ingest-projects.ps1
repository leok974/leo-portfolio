Param(
  [string]$Base = "http://127.0.0.1:8023"
)
Write-Host "Ingesting projects_knowledge.json into RAG at $Base..." -ForegroundColor Cyan
try {
  $resp = Invoke-RestMethod -Uri "$Base/api/rag/ingest/projects" -Method POST
  $resp | ConvertTo-Json -Depth 5
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
