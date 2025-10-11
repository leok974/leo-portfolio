# GitHub Actions CI Step Examples

## Agent Validation with Payload File

Add this step to your `.github/workflows/*.yml`:

```yaml
- name: Validate Payloads (JSON Schema)
  run: npm run payload:validate

- name: Agent run (seo.validate with payload file)
  env:
    AGENT_API_BASE: ${{ vars.PUBLIC_API_ORIGIN || 'https://api.siteagents.app' }}
    AGENT_TOKEN: ${{ secrets.SITEAGENT_TOKEN || 'dev' }}
    AGENT_TIMEOUT_MS: "180000"
  run: npm run agent:seo:validate:file

- name: Check Agent Results
  if: failure()
  run: |
    echo "❌ Agent validation failed"
    echo "Review the agent output above for details"
    exit 1
```

## Complete Workflow Example

```yaml
name: Agent Validation

on:
  push:
    branches: [main, develop]
    paths:
      - 'src/**/*.html'
      - 'src/**/*.tsx'
      - 'src/**/*.ts'
      - 'public/**'
      - 'scripts/payloads/**'
  pull_request:
    branches: [main]

jobs:
  validate:
    name: SEO Validation
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Validate Payload Schemas
        run: npm run payload:validate

      - name: Run SEO Validation
        env:
          AGENT_API_BASE: ${{ vars.PUBLIC_API_ORIGIN || 'https://api.siteagents.app' }}
          AGENT_TOKEN: ${{ secrets.SITEAGENT_TOKEN || 'dev' }}
          AGENT_TIMEOUT_MS: "180000"
        run: npm run agent:seo:validate:file

      - name: Upload Agent Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: agent-results-${{ github.run_number }}
          path: agent/artifacts/**/*
          retention-days: 30
```

## Pre-commit Hook (Husky)

Already configured in `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run payload:validate && npm run -s lint || true
```

This runs on every commit to ensure payloads are valid before committing.
