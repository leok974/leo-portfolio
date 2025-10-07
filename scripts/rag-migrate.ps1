Param(
  [string]$Base = "http://127.0.0.1:8023",
  [string]$AdminToken = $Env:ADMIN_TOKEN
)

if (-not $AdminToken) { Write-Error "ADMIN_TOKEN not set. Pass -AdminToken or set `$Env:ADMIN_TOKEN."; exit 1 }

$Headers = @{ 'X-Admin-Token' = $AdminToken }

Write-Host "Ensuring RAG schema..." -ForegroundColor Cyan
$resp = Invoke-RestMethod -Uri "$Base/api/rag/admin/migrate" -Method POST -Headers $Headers
$resp | ConvertTo-Json -Depth 5

Write-Host "Ingesting projects from projects_knowledge.json..." -ForegroundColor Cyan
$ing = Invoke-RestMethod -Uri "$Base/api/rag/ingest/projects" -Method POST -Headers $Headers
$ing | ConvertTo-Json -Depth 5
