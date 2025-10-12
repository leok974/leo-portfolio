#!/usr/bin/env bash
set -euo pipefail

alias_ui="siteagent-ui.int"
alias_api="siteagent-api.int"
net="infra_net"

fail=0
echo "[tunnel-guard] scanning containers on $net for duplicate aliases…"

for c in $(docker ps --format '{{.Names}}'); do
  info=$(docker inspect "$c" --format '{{json .NetworkSettings.Networks}}' 2>/dev/null || true)
  [[ -z "$info" ]] && continue

  if echo "$info" | grep -q "\"$net\""; then
    aliases=$(echo "$info" | jq -r --arg N "$net" '.[$N].Aliases[]?' 2>/dev/null || true)

    # Check for duplicate siteagent-ui.int (should only be on portfolio-nginx)
    if echo "$aliases" | grep -qx "$alias_ui" && [[ "$c" != *"portfolio-nginx"* ]]; then
      echo "❌ duplicate $alias_ui on $c"
      fail=1
    fi

    # Check for duplicate siteagent-api.int (should only be on portfolio-backend)
    if echo "$aliases" | grep -qx "$alias_api" && [[ "$c" != *"portfolio-backend"* ]]; then
      echo "❌ duplicate $alias_api on $c"
      fail=1
    fi
  fi
done

[[ $fail -eq 0 ]] && echo "✅ no duplicate aliases found"
exit $fail
