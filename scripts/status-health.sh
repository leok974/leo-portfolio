#!/usr/bin/env bash
set -euo pipefail
ORIGIN="${1:-https://leok974.github.io}"
HOST="${2:-assistant.ledger-mind.org}"
echo "Origin: $ORIGIN"; echo "Host:   $HOST"; echo

echo "GET /api/status/summary"
curl -is -H "Origin: $ORIGIN" "https://${HOST}/api/status/summary" | sed -n '1,40p' | tee /tmp/hs_api_headers.txt
grep -E '^HTTP/.* 200' /tmp/hs_api_headers.txt >/dev/null
grep -F "Access-Control-Allow-Origin: ${ORIGIN}" /tmp/hs_api_headers.txt >/dev/null
grep -F 'Vary: Origin' /tmp/hs_api_headers.txt >/dev/null || echo 'WARN: Vary header missing'
grep -F 'X-Status-Path: api' /tmp/hs_api_headers.txt >/dev/null && echo '(debug) Confirmed X-Status-Path: api' || echo '(debug) No X-Status-Path header'

echo -e "\nOPTIONS /api/status/summary"
curl -is -X OPTIONS -H "Origin: $ORIGIN" -H "Access-Control-Request-Method: GET" \
  "https://${HOST}/api/status/summary" | sed -n '1,40p' | tee /tmp/hs_opt_headers.txt
grep -E '^HTTP/.* (204|200)' /tmp/hs_opt_headers.txt >/dev/null
grep -F "Access-Control-Allow-Origin: ${ORIGIN}" /tmp/hs_opt_headers.txt >/dev/null

echo -e "\nLegacy GET /status/summary (informational)"
curl -is -H "Origin: $ORIGIN" "https://${HOST}/status/summary" | sed -n '1,40p' || true

echo "\nDone.";
