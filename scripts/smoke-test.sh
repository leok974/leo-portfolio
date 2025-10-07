#!/usr/bin/env bash
# Post-deployment smoke tests
# Usage: ./scripts/smoke-test.sh https://your-domain.com $ADMIN_TOKEN

set -e

HOST="${1:-http://localhost:8000}"
ADMIN_TOKEN="${2}"

echo "🔍 Running smoke tests for: $HOST"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
  echo -e "${GREEN}✓${NC} $1"
}

fail() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Test 1: Backend health check
echo ""
echo "1️⃣  Testing backend health..."
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/ready.json "$HOST/ready")
if [ "$RESPONSE" = "200" ]; then
  pass "Backend is healthy"
  cat /tmp/ready.json | jq '.' 2>/dev/null || cat /tmp/ready.json
else
  fail "Backend health check failed (HTTP $RESPONSE)"
fi

# Test 2: RAG system diagnostics
echo ""
echo "2️⃣  Testing RAG system..."
if [ -z "$ADMIN_TOKEN" ]; then
  warn "ADMIN_TOKEN not provided, skipping RAG diagnostics"
else
  RESPONSE=$(curl -s -H "X-Admin-Token: $ADMIN_TOKEN" "$HOST/api/rag/diag/rag")

  # Check user_version
  VERSION=$(echo "$RESPONSE" | jq -r '.env.user_version' 2>/dev/null)
  if [ "$VERSION" = "4" ]; then
    pass "RAG schema version correct (4)"
  else
    fail "RAG schema version mismatch (expected 4, got $VERSION)"
  fi

  # Check database exists
  DB_EXISTS=$(echo "$RESPONSE" | jq -r '.files.rag_db.exists' 2>/dev/null)
  if [ "$DB_EXISTS" = "true" ]; then
    pass "RAG database exists"
  else
    fail "RAG database not found"
  fi

  # Check embeddings count
  EMB_COUNT=$(echo "$RESPONSE" | jq -r '.stats.embeddings_count' 2>/dev/null)
  if [ "$EMB_COUNT" != "null" ] && [ "$EMB_COUNT" -gt 0 ]; then
    pass "RAG has $EMB_COUNT embeddings"
  else
    warn "RAG has no embeddings or count unavailable"
  fi
fi

# Test 3: Homepage loads
echo ""
echo "3️⃣  Testing homepage..."
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/index.html "$HOST/")
if [ "$RESPONSE" = "200" ]; then
  pass "Homepage loads (HTTP 200)"
else
  fail "Homepage failed to load (HTTP $RESPONSE)"
fi

# Test 4: Calendly popup button present
echo ""
echo "4️⃣  Testing Calendly popup integration..."
if grep -q 'data-calendly-url' /tmp/index.html; then
  pass "Calendly popup button found on homepage"
  CALENDLY_URL=$(grep -o 'data-calendly-url="[^"]*"' /tmp/index.html | head -1)
  echo "   └─ $CALENDLY_URL"
else
  fail "Calendly popup button not found on homepage"
fi

# Test 5: Book page loads
echo ""
echo "5️⃣  Testing booking page..."
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/book.html "$HOST/book.html")
if [ "$RESPONSE" = "200" ]; then
  pass "Booking page loads (HTTP 200)"
else
  fail "Booking page failed to load (HTTP $RESPONSE)"
fi

# Test 6: Calendly inline widget configured
echo ""
echo "6️⃣  Testing Calendly inline widget..."
if grep -q 'calendly-inline' /tmp/book.html; then
  pass "Calendly inline widget found"
  if grep -q 'data-calendly-url' /tmp/book.html; then
    pass "Inline widget is configured"
    INLINE_URL=$(grep -o 'data-calendly-url="[^"]*"' /tmp/book.html | head -1)
    echo "   └─ $INLINE_URL"
  else
    warn "Inline widget found but not configured"
  fi
else
  fail "Calendly inline widget not found"
fi

# Test 7: Calendly helper script accessible
echo ""
echo "7️⃣  Testing Calendly helper script..."
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/calendly.js "$HOST/assets/js/calendly.js")
if [ "$RESPONSE" = "200" ]; then
  pass "calendly.js is accessible"

  # Check for key functions
  if grep -q 'trackAnalytics' /tmp/calendly.js; then
    pass "Analytics tracking function found"
  else
    warn "Analytics tracking function not found in calendly.js"
  fi

  if grep -q '__calendlyHelperLoaded' /tmp/calendly.js; then
    pass "Helper readiness signal found"
  else
    warn "Helper readiness signal not found"
  fi
else
  fail "calendly.js not accessible (HTTP $RESPONSE)"
fi

# Test 8: CSP headers check
echo ""
echo "8️⃣  Testing Content Security Policy..."
CSP=$(curl -s -I "$HOST/book.html" | grep -i "content-security-policy" || echo "")
if [ -n "$CSP" ]; then
  pass "CSP header present on book.html"
  if echo "$CSP" | grep -q "assets.calendly.com"; then
    pass "CSP allows Calendly assets"
  else
    warn "CSP may not allow Calendly assets"
  fi
else
  warn "No CSP header found on book.html"
fi

# Test 9: Font preconnect
echo ""
echo "9️⃣  Testing font configuration..."
if grep -q 'fonts.gstatic.com' /tmp/index.html; then
  pass "Google Fonts preconnect found"
else
  warn "Google Fonts preconnect not found"
fi

# Test 10: Cache headers
echo ""
echo "🔟 Testing cache headers..."
CACHE=$(curl -s -I "$HOST/assets/js/calendly.js" | grep -i "cache-control" || echo "")
if [ -n "$CACHE" ]; then
  pass "Cache-Control header present"
  echo "   └─ $CACHE"
else
  warn "No Cache-Control header on static assets"
fi

# Test 11: Chat endpoint (basic)
echo ""
echo "1️⃣1️⃣  Testing chat endpoint..."
CHAT_RESPONSE=$(curl -s -X POST "$HOST/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","stream":false}' \
  -w "%{http_code}" -o /tmp/chat.json)

if [ "$CHAT_RESPONSE" = "200" ]; then
  pass "Chat endpoint responds"
  RESPONSE_TEXT=$(cat /tmp/chat.json | jq -r '.response' 2>/dev/null || echo "")
  if [ -n "$RESPONSE_TEXT" ] && [ "$RESPONSE_TEXT" != "null" ]; then
    pass "Chat returns valid response"
    echo "   └─ Response length: ${#RESPONSE_TEXT} chars"
  else
    warn "Chat response is empty or invalid"
  fi
else
  warn "Chat endpoint returned HTTP $CHAT_RESPONSE"
fi

# Summary
echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Smoke tests completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Test Calendly popup manually in browser"
echo "  2. Test inline booking page manually"
echo "  3. Verify analytics events in browser console"
echo "  4. Monitor logs for any errors"
echo ""
echo "Monitoring commands:"
echo "  journalctl -u assistant-api -f              # Watch backend logs"
echo "  tail -f /var/log/nginx/access.log           # Watch Nginx access logs"
echo "  tail -f /var/log/nginx/error.log            # Watch Nginx errors"
echo ""
