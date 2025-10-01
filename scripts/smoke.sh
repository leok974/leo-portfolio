#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${1:-http://127.0.0.1:8001}"

pass() { echo -e "\e[32m[PASS]\e[0m $1"; [ $# -gt 1 ] && echo "       $2"; }
fail() { echo -e "\e[31m[FAIL]\e[0m $1"; [ $# -gt 1 ] && echo "       $2"; }

get() { curl -fsS --max-time 10 "$1"; }
post_json() { curl -fsS --max-time 25 -H 'Content-Type: application/json' -d "$2" "$1"; }

# /ready
if out=$(get "$BASE_URL/ready" 2>/tmp/err_ready); then
  pass "/ready" "$out"
else
  fail "/ready" "$(cat /tmp/err_ready)"
fi

# /llm/health
if out=$(get "$BASE_URL/llm/health" 2>/tmp/err_health); then
  pass "/llm/health" "$out"
else
  fail "/llm/health" "$(cat /tmp/err_health)"
fi

# /metrics
if out=$(get "$BASE_URL/metrics" 2>/tmp/err_metrics); then
  pass "/metrics" "$out"
else
  fail "/metrics" "$(cat /tmp/err_metrics)"
fi

# /chat
BODY='{"messages":[{"role":"user","content":"In one sentence, what is Leo\'s portfolio about?"}],"stream":false}'
if out=$(post_json "$BASE_URL/chat" "$BODY" 2>/tmp/err_chat); then
  served=$(jq -r '._served_by // empty' <<<"$out" 2>/dev/null || true)
  text=$(jq -r '.choices[0].message.content // empty' <<<"$out" 2>/dev/null || true)
  if [[ -n "$text" ]]; then
    pass "/chat" "served_by=$served; text_len=${#text}"
  else
    fail "/chat" "$out"
  fi
else
  fail "/chat" "$(cat /tmp/err_chat)"
fi
