#!/bin/bash
# Production Runner Security Health Check
# Usage: ./scripts/check-prod-runner-security.sh

set -e

echo "🔒 Production Runner Security Check"
echo "===================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

check() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  
  echo -n "   $name: "
  if [ "$expected" = "$actual" ]; then
    echo -e "${GREEN}✓${NC} $actual"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} Expected: $expected, Got: $actual"
    ((FAIL++))
  fi
}

echo "1️⃣  Checking workflow hardening..."
SELF_HOSTED_COUNT=$(grep -r "runs-on.*self-hosted" .github/workflows/*.yml 2>/dev/null | wc -l | tr -d ' ')
check "Self-hosted workflows" "3" "$SELF_HOSTED_COUNT"

echo ""
echo "2️⃣  Checking PR safety..."
PR_SELF_HOSTED=$(grep -l "pull_request" .github/workflows/*.yml 2>/dev/null | xargs grep -l "self-hosted" 2>/dev/null | wc -l | tr -d ' ')
check "PR workflows using self-hosted" "0" "$PR_SELF_HOSTED"

echo ""
echo "3️⃣  Checking environment protection..."
ENV_COUNT=$(grep -r "environment: production" .github/workflows/*.yml 2>/dev/null | wc -l | tr -d ' ')
check "Workflows with environment protection" "3" "$ENV_COUNT"

echo ""
echo "4️⃣  Checking permissions..."
MINIMAL_PERMS=$(grep -A1 "^permissions:" .github/workflows/{bootstrap-watchtower,smoke-selfhosted,redeploy-backend}.yml 2>/dev/null | grep "contents: read" | wc -l | tr -d ' ')
check "Workflows with read-only permissions" "3" "$MINIMAL_PERMS"

echo ""
echo "5️⃣  Checking concurrency control..."
CONCURRENCY_COUNT=$(grep "^concurrency:" .github/workflows/{bootstrap-watchtower,smoke-selfhosted,redeploy-backend}.yml 2>/dev/null | wc -l | tr -d ' ')
echo -n "   Workflows with concurrency control: "
if [ "$CONCURRENCY_COUNT" -ge "2" ]; then
  echo -e "${GREEN}✓${NC} $CONCURRENCY_COUNT"
  ((PASS++))
else
  echo -e "${YELLOW}⚠${NC} $CONCURRENCY_COUNT (expected: at least 2)"
fi

echo ""
echo "6️⃣  Checking PR guards..."
PR_GUARD_COUNT=$(grep -B5 "runs-on.*self-hosted" .github/workflows/*.yml 2>/dev/null | grep -c "pull_request" || echo "0")
echo -n "   PR guards in self-hosted workflows: "
if [ "$PR_GUARD_COUNT" -ge "3" ]; then
  echo -e "${GREEN}✓${NC} Found"
  ((PASS++))
else
  echo -e "${YELLOW}⚠${NC} May need verification"
fi

echo ""
echo "7️⃣  Checking runner status (requires gh CLI and auth)..."
if command -v gh &> /dev/null; then
  RUNNER_STATUS=$(gh api repos/leok974/leo-portfolio/actions/runners 2>/dev/null | jq -r '.runners[] | "   \(.name): \(.status)"' || echo "   (unable to fetch - check gh auth)")
  echo "$RUNNER_STATUS"
else
  echo "   ${YELLOW}⚠${NC} gh CLI not installed (skip)"
fi

echo ""
echo "8️⃣  Recent workflow runs..."
if command -v gh &> /dev/null; then
  gh run list --limit 5 --json workflowName,conclusion,createdAt 2>/dev/null | \
    jq -r '.[] | "   \(.workflowName): \(.conclusion)"' || echo "   (unable to fetch - check gh auth)"
else
  echo "   ${YELLOW}⚠${NC} gh CLI not installed (skip)"
fi

echo ""
echo "=================================="
echo "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}✅ All critical checks passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some checks failed. Review settings.${NC}"
  exit 1
fi
