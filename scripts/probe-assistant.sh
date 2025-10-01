#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-https://assistant.ledger-mind.org}"
ORIGIN="https://leok974.github.io"
probe(){
  local path="$1"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: $ORIGIN" -H 'Accept: application/json' -L "$BASE$path")
  local acao
  acao=$(curl -s -D - -o /dev/null -H "Origin: $ORIGIN" -H 'Accept: application/json' -L "$BASE$path" | awk -F': ' 'BEGIN{IGNORECASE=1} /access-control-allow-origin/{print $2}' | tr -d '\r')
  echo "$path => $code, ACAO=$acao"
  if [[ "$code" == "200" && ( "$acao" == "$ORIGIN" || "$acao" == "*" ) ]]; then
    return 0
  fi
  return 1
}
probe /status/summary || probe /llm/health || probe /ready
