#!/usr/bin/env bash
# Check that all script tags in built HTML have nonce attributes
# Used in CI to prevent CSP bypass regressions

set -euo pipefail

f="dist-portfolio/index.html"

# Check file exists
if [ ! -f "$f" ]; then
  echo "❌ Build artifact not found: $f" >&2
  exit 1
fi

# Check if file has any script tags
if ! grep -q '<script' "$f"; then
  echo "⚠️  No script tags found in $f (unexpected)" >&2
  exit 1
fi

# Find script tags without nonce attribute
missing_nonce=$(grep -n '<script' "$f" | grep -v 'nonce=' || true)

if [ -n "$missing_nonce" ]; then
  echo "❌ Found script tags without nonce in $f:" >&2
  echo "$missing_nonce" >&2
  echo "" >&2
  echo "All script tags must have nonce=\"__CSP_NONCE__\" for CSP enforcement" >&2
  exit 1
fi

# Count script tags for visibility
script_count=$(grep -c '<script' "$f" || true)
echo "✅ All $script_count script tags have nonce in $f"
