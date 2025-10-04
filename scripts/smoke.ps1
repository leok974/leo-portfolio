Param(
  [string]$Port = '8023',
  [string]$Db = 'D:/leo-portfolio/data/rag_8023.sqlite'
)

Write-Host "[smoke] using port $Port" -ForegroundColor Cyan

# Kill old listener if present
$pid = (Get-NetTCPConnection -LocalPort [int]$Port -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($pid) { taskkill /PID $pid /F | Out-Null; Write-Host "[smoke] killed:$pid" -ForegroundColor Yellow }

# Env for local gen via Ollama
$env:SAFE_LIFESPAN = '1'
$env:DISABLE_PRIMARY = '0'
$env:DEV_ALLOW_NO_LLM = '0'
$env:PRIMARY_BASE_URL = 'http://127.0.0.1:11434/v1'
$env:OPENAI_API_KEY_OLLAMA = 'ollama'
$env:OPENAI_MODEL = 'qwen2.5:7b-instruct'
$env:RAG_DB = $Db
Remove-Item Env:RAG_URL -ErrorAction SilentlyContinue

# Start detached
$args = @('-m','uvicorn','assistant_api.main:app','--host','127.0.0.1','--port',$Port,'--log-level','warning')
$p = Start-Process -FilePath 'D:/leo-portfolio/.venv/Scripts/python.exe' -ArgumentList $args -PassThru
Start-Sleep -Seconds 2
$base = "http://127.0.0.1:$Port"

# Ping (best-effort)
try { Invoke-RestMethod -UseBasicParsing -TimeoutSec 5 "$base/api/ping" | Out-Null } catch {}

# Chat + metrics (best-effort)
$chat = @{ messages=@(@{role='user';content='Say hi in one sentence with a source note.'}); include_sources=$true } | ConvertTo-Json
try { Invoke-RestMethod -UseBasicParsing -TimeoutSec 60 -Method POST -Uri "$base/chat" -ContentType 'application/json' -Body $chat | Out-Null } catch {}
$metrics = $null
try { $metrics = Invoke-RestMethod -UseBasicParsing -TimeoutSec 10 "$base/api/metrics" } catch {}

# Output
[pscustomobject]@{
  pid            = $p.Id
  base           = $base
  gen_backend    = $metrics.metrics.gen.last_backend
  gen_last_ms    = $metrics.metrics.gen.last_ms
  embed_backend  = $metrics.metrics.embeddings.last_backend
  rerank_backend = $metrics.metrics.rerank.last_backend
} | Format-List

