#!/bin/bash
# Setup Production Environment Secrets
# Run this script to copy secrets from repository to production environment

echo "Setting up production environment secrets..."
echo ""
echo "⚠️  You'll need to paste the secret values when prompted"
echo "    Copy values from: Settings → Secrets and variables → Actions → Repository secrets"
echo ""

# WATCHTOWER_HTTP_API_TOKEN
echo "1/6: WATCHTOWER_HTTP_API_TOKEN"
echo "    Current repo secret: WATCHTOWER_HTTP_API_TOKEN (copy the value)"
gh secret set WATCHTOWER_HTTP_API_TOKEN --env production
echo "✅ Set"
echo ""

# WATCHTOWER_UPDATE_URL  
echo "2/6: WATCHTOWER_UPDATE_URL"
echo "    Value: https://api.leoklemet.com/ops/watchtower/update"
echo "https://api.leoklemet.com/ops/watchtower/update" | gh secret set WATCHTOWER_UPDATE_URL --env production
echo "✅ Set"
echo ""

# FIGMA_PAT
echo "3/6: FIGMA_PAT"
echo "    Current repo secret: FIGMA_PAT (copy the value)"
gh secret set FIGMA_PAT --env production
echo "✅ Set"
echo ""

# FIGMA_TEMPLATE_KEY
echo "4/6: FIGMA_TEMPLATE_KEY"
echo "    Current repo secret: FIGMA_TEMPLATE_KEY (copy the value)"
gh secret set FIGMA_TEMPLATE_KEY --env production
echo "✅ Set"
echo ""

# FIGMA_TEAM_ID
echo "5/6: FIGMA_TEAM_ID"
echo "    Current repo secret: FIGMA_TEAM_ID (copy the value or press Enter for empty)"
gh secret set FIGMA_TEAM_ID --env production
echo "✅ Set"
echo ""

# OPENAI_API_KEY (optional fallback)
echo "6/6: OPENAI_API_KEY (optional)"
echo "    Current repo secret: OPENAI_API_KEY (copy the value or skip)"
read -p "Set OPENAI_API_KEY? (y/N): " set_openai
if [[ "$set_openai" =~ ^[Yy]$ ]]; then
  gh secret set OPENAI_API_KEY --env production
  echo "✅ Set"
else
  echo "⏭️  Skipped"
fi
echo ""

echo "✅ Production environment secrets configured!"
echo ""
echo "Verify with: gh secret list --env production"
