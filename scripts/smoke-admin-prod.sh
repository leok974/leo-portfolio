#!/usr/bin/env bash
set -euo pipefail

SITE="${SITE:-https://assistant.ledger-mind.org}"
EMAIL="${ADMIN_EMAIL:-you@yourdomain.com}"

echo "== Admin login =="
hdrs=$(mktemp); body=$(mktemp)
curl -sS -D "$hdrs" -o "$body" -X POST "$SITE/api/auth/admin/login?email=$EMAIL"
grep -i '^set-cookie:' "$hdrs" | sed -n '1p' || { echo "No Set-Cookie found" >&2; exit 1; }
C=$(grep -i '^set-cookie:' "$hdrs" | sed -n 's/.*admin_auth=\([^;]*\).*/\1/p' | head -n1)
test -n "$C" || { echo "Could not extract admin_auth cookie" >&2; exit 1; }

echo "== /api/auth/me =="
curl -sS -H "Cookie: admin_auth=$C" "$SITE/api/auth/me"

echo -e "\n== Protected endpoints (should be 200) =="
curl -sS -o /dev/null -w "%{http_code}\n" -H "Cookie: admin_auth=$C" -X POST "$SITE/api/layout/reset"
curl -sS -o /dev/null -w "%{http_code}\n" -H "Cookie: admin_auth=$C" -X POST "$SITE/api/layout/autotune"

echo "== Protected without cookie (should be 401/403) =="
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$SITE/api/layout/reset"

rm -f "$hdrs" "$body"
echo "✅ Smoke complete"
