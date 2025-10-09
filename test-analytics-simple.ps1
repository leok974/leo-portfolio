# Simple test for Phase 50.6 Analytics Ingestion and SEO Tune
# Uses Python script to handle HMAC auth like E2E tests

$ErrorActionPreference = "Stop"

Write-Host "`n=== Phase 50.6 Analytics & SEO Tune Test ===" -ForegroundColor Cyan

# Check backend
Write-Host "`n[1/3] Checking backend..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8001/ready" -Method Get
    Write-Host "✓ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend not running" -ForegroundColor Red
    exit 1
}

# Enable dev overlay using Python script
Write-Host "`n[2/3] Enabling dev overlay and testing analytics..." -ForegroundColor Yellow

$pythonScript = @'
import requests
import hmac
import hashlib
import os
from datetime import datetime, timezone

# Enable dev overlay
secret = os.getenv("DEV_OVERLAY_SECRET", "dev-secret-change-in-production")
ts = datetime.now(timezone.utc).isoformat()
msg = f"enable:{ts}"
sig = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()

enable_resp = requests.post(
    "http://127.0.0.1:8001/agent/dev/enable",
    json={"timestamp": ts, "signature": sig}
)
print(f"Dev overlay: {enable_resp.status_code}")

# Get cookie
cookies = enable_resp.cookies

# Ingest analytics
ingest_data = {
    "source": "search_console",
    "rows": [
        {"url": "/projects/datapipe-ai", "impressions": 624, "clicks": 5},
        {"url": "/projects/derma-ai", "impressions": 1123, "clicks": 104},
        {"url": "/projects/clarity", "impressions": 892, "clicks": 8},
        {"url": "/", "impressions": 5234, "clicks": 456}
    ]
}

ingest_resp = requests.post(
    "http://127.0.0.1:8001/agent/analytics/ingest",
    json=ingest_data,
    cookies=cookies
)

if ingest_resp.status_code == 200:
    result = ingest_resp.json()
    print(f"✓ Analytics ingested: {result['rows']} rows, {result['inserted_or_updated']} updated")
else:
    print(f"✗ Ingest failed: {ingest_resp.status_code} - {ingest_resp.text}")
    exit(1)

# Run SEO tune
tune_resp = requests.post(
    "http://127.0.0.1:8001/agent/run?task=seo.tune",
    json={"threshold": 0.02},
    cookies=cookies
)

if tune_resp.status_code == 200:
    result = tune_resp.json()
    print(f"✓ SEO tune completed: {result.get('count', 0)} pages analyzed")
    print(f"  JSON: {result.get('json', 'N/A')}")
    print(f"  MD: {result.get('md', 'N/A')}")
else:
    print(f"✗ Tune failed: {tune_resp.status_code} - {tune_resp.text}")
    exit(1)
'@

try {
    $pythonScript | python -
    Write-Host "✓ All API calls succeeded" -ForegroundColor Green
} catch {
    Write-Host "✗ Test failed: $_" -ForegroundColor Red
    exit 1
}

# Verify artifacts
Write-Host "`n[3/3] Verifying artifacts..." -ForegroundColor Yellow

$jsonPath = "agent_artifacts/seo-tune.json"
$mdPath = "agent_artifacts/seo-tune.md"

if (Test-Path $jsonPath) {
    Write-Host "✓ JSON artifact exists: $jsonPath" -ForegroundColor Green
    $json = Get-Content $jsonPath -Raw | ConvertFrom-Json
    Write-Host "  - Pages: $($json.count)" -ForegroundColor Gray
    Write-Host "  - Threshold: $($json.threshold)" -ForegroundColor Gray
} else {
    Write-Host "✗ JSON artifact not found" -ForegroundColor Red
}

if (Test-Path $mdPath) {
    Write-Host "✓ MD artifact exists: $mdPath" -ForegroundColor Green
} else {
    Write-Host "✗ MD artifact not found" -ForegroundColor Red
}

Write-Host "`n=== Test complete! ===" -ForegroundColor Green
