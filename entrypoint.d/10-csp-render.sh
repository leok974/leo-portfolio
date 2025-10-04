#!/usr/bin/env sh
# entrypoint.d/10-csp-render.sh
# Compute CSP hashes for inline <script> blocks and inject into nginx.conf.
# Compatible with Alpine/BusyBox. Requires openssl (installed on first run).
# Idempotent: will not duplicate existing hashes.

set -eu

NGINX_CONF="${NGINX_CONF:-/etc/nginx/nginx.conf}"
INDEX_HTML="${INDEX_HTML:-/usr/share/nginx/html/index.html}"
PLACEHOLDERS="${CSP_PLACEHOLDERS:-__CSP_INLINE_HASHES__ __INLINE_CSP_HASH__}"

log() { printf '[csp-render] %s\n' "$*"; }

need_openssl() {
  if ! command -v openssl >/dev/null 2>&1; then
    log "openssl not found; installing (apk add --no-cache openssl)…"
    apk add --no-cache openssl >/dev/null 2>&1 || {
      log "ERROR: cannot install openssl (apk unavailable?)"; exit 0; }
  fi
}

file_exists_or_skip() {
  if [ ! -f "$1" ]; then
    log "INFO: $1 not found; skipping CSP hash render."
    exit 0
  fi
}

# Extract all inline <script> contents from index.html (skip tags with src=)
# Handles <script> ... </script> possibly on one line; ignores CRLF.
extract_inline_scripts() {
  awk '
    BEGIN { inblk=0 }
    # skip any script tag that has a src=
    /<script[^>]*src=/ { next }

    # opening tag: <script ...>
    /<script[^>]*>/ {
      # strip everything up to the closing of opening tag
      inblk=1
      sub(/.*<script[^>]*>/,"")
      # same-line close?
      if ($0 ~ /<\/script>/) {
        line=$0
        sub(/<\/script>.*/,"",line)
        print line
        print "-----CSP_SPLIT-----"
        inblk=0
      } else {
        print
      }
      next
    }

    inblk==1 {
      if ($0 ~ /<\/script>/) {
        line=$0
        sub(/<\/script>.*/,"",line)
        print line
        print "-----CSP_SPLIT-----"
        inblk=0
      } else {
        print
      }
    }
  ' "$INDEX_HTML" | tr -d '\r'
}

# Compute sha256 base64 for a blob (stdin)
hash_stdin() {
  openssl dgst -sha256 -binary | openssl base64
}

inject_placeholder_or_append() {
  conf="$1"; hashes_line="$2"; inserted=0

  # If a known placeholder token exists, replace first occurrence.
  for p in $PLACEHOLDERS; do
    if grep -q "$p" "$conf"; then
      # shellcheck disable=SC2016
      sed -i "0,/$p/s//$hashes_line/" "$conf"
      log "Injected hashes via placeholder '$p'."
      inserted=1
      break
    fi
  done

  if [ "$inserted" -eq 1 ]; then return; fi

  # Otherwise, ensure each hash appears after the first "script-src 'self'"
  # We do it one-by-one to avoid reordering other policy tokens.
  for h in $hashes_line; do
    # h is quoted like 'sha256-XYZ='
    if grep -q "$h" "$conf"; then
      log "Hash $h already present; skipping."
      continue
    fi
    # Insert after first match of script-src 'self'
    # shellcheck disable=SC2016
    sed -i "0,/script-src '\''self'\''/s//& $h/" "$conf"
    log "Inserted $h after \"script-src 'self'\"."
  done
}

main() {
  file_exists_or_skip "$INDEX_HTML"
  file_exists_or_skip "$NGINX_CONF"
  need_openssl

  log "Scanning $INDEX_HTML for inline <script> blocks…"
  tmpdir="$(mktemp -d)"
  scripts_file="$tmpdir/scripts.txt"
  extract_inline_scripts > "$scripts_file"

  count=0
  hashes=""
  buf=""
  while IFS= read -r line || [ -n "$line" ]; do
    if [ "$line" = "-----CSP_SPLIT-----" ]; then
      if [ -n "$buf" ]; then
        h="$(printf '%s' "$buf" | hash_stdin)"
        hashes="$hashes 'sha256-$h'"
        count=$((count+1))
      fi
      buf=""
    else
      # Reconstruct original newlines faithfully
      if [ -z "$buf" ]; then
        buf="$line"
      else
        buf="$buf\n$line"
      fi
    fi
  done < "$scripts_file"

  # If the file ended without a split marker but had content, hash it.
  if [ -n "$buf" ]; then
    h="$(printf '%s' "$buf" | hash_stdin)"
    hashes="$hashes 'sha256-$h'"
    count=$((count+1))
  fi

  rm -rf "$tmpdir"

  if [ "$count" -eq 0 ]; then
    log "No inline <script> blocks found; nothing to inject."
    exit 0
  fi

  # Deduplicate hashes while preserving order
  uniq_hashes=""
  for h in $hashes; do
    echo "$uniq_hashes" | grep -q -F " $h " && continue
    uniq_hashes="$uniq_hashes $h "
  done
  uniq_hashes="$(echo "$uniq_hashes" | xargs)"

  log "Computed $count inline script hash(es)."
  inject_placeholder_or_append "$NGINX_CONF" "$uniq_hashes"

  # Optional: show the CSP line(s) for debugging
  log "Current CSP (snippet):"
  grep -n -i "content-security-policy" "$NGINX_CONF" || true
}

main "$@"
