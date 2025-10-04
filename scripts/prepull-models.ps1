Param(
  [string]$EmbedModel   = "BAAI/bge-m3",
  [string]$RerankModel  = "BAAI/bge-reranker-base",
  [string]$LocalGenModel = "llama3.1:8b-instruct",
  [switch]$SkipOllama
)

# Optional: put the HF cache on a fast disk (uncomment & adjust):
# $env:HF_HOME = "D:/hf-cache"

# Use project venv python
$py = "D:/leo-portfolio/.venv/Scripts/python.exe"
if (-not (Test-Path $py)) { Write-Error "venv python not found at $py"; exit 1 }

# Ensure deps exist
& $py -m pip install -q sentence-transformers --upgrade
if ($LASTEXITCODE -ne 0) { Write-Error "pip install failed"; exit $LASTEXITCODE }

# Force-download SentenceTransformer + CrossEncoder weights and tokenizers
$code = @"
import os
from sentence_transformers import SentenceTransformer, CrossEncoder
print("↓ pulling embedding model:", os.getenv("EMBED_MODEL") or "$EmbedModel")
m = SentenceTransformer("$EmbedModel", device="cpu")
_ = m.encode(["warmup 1","warmup 2"], normalize_embeddings=True, convert_to_numpy=True, batch_size=2, show_progress_bar=False)
print("✅ embedding ready")

print("↓ pulling reranker model:", os.getenv("RERANK_MODEL") or "$RerankModel")
r = CrossEncoder("$RerankModel", device="cpu")
_ = r.predict([("warmup","This is a warmup passage.")])
print("✅ reranker ready")

import pathlib, sys
cache = os.environ.get("HF_HOME") or os.path.join(pathlib.Path.home(), ".cache", "huggingface")
print("HF cache:", cache)
"@

# Pipe code to python stdin (PowerShell-friendly)
$code | & $py -
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Pull Ollama model (if installed and not skipped)
if (-not $SkipOllama) {
  $ollama = (Get-Command ollama -ErrorAction SilentlyContinue)
  if ($null -ne $ollama) {
    Write-Host "↓ pulling Ollama model: $LocalGenModel"
    ollama pull $LocalGenModel
    if ($LASTEXITCODE -ne 0) { Write-Warning "ollama pull returned $LASTEXITCODE" }
  } else {
    Write-Warning "Ollama not found in PATH. Skip pulling local gen. (Install Ollama and re-run to pre-pull $LocalGenModel.)"
  }
}

Write-Host "All set. Models cached locally."
