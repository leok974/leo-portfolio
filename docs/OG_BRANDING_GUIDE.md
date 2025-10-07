# OG Card Branding & Renaming Guide

## Overview

The `overrides.update` agent task allows you to dynamically manage OG (Open Graph) card branding and project name aliases via the siteAgent API. This enables you to customize how your projects appear in social media previews without touching code or templates.

## Single Source of Truth

All branding flows from `./assets/data/og-overrides.json`:

```
overrides.update task
        ↓
og-overrides.json
        ↓
┌───────┴───────┐
↓               ↓
og.generate   status.write
↓               ↓
OG images    siteAgent.json
             ↓
        Footer + Report
```

## Usage Modes

### 1. Rename by Repository (Recommended)

Rename a project using its full repository path (e.g., `leok974/leo-portfolio` → `siteAgent`):

```bash
curl -s -X POST https://assistant.ledger-mind.org/agent/run \
  -H "Content-Type: application/json" \
  -H "X-SiteAgent-Signature: sha256=<hmac>" \
  -d '{
    "plan": ["overrides.update", "og.generate", "status.write"],
    "params": {
      "rename": {
        "repo": "leok974/leo-portfolio",
        "to": "siteAgent"
      }
    }
  }' | jq
```

**When to use:** You know the exact GitHub repository path. This is the most explicit and reliable method.

### 2. Rename by Current Title

Rename a project using its current display name:

```bash
curl -s -X POST https://assistant.ledger-mind.org/agent/run \
  -H "Content-Type: application/json" \
  -H "X-SiteAgent-Signature: sha256=<hmac>" \
  -d '{
    "plan": ["overrides.update", "og.generate", "status.write"],
    "params": {
      "rename": {
        "from": "leo-portfolio",
        "to": "siteAgent"
      }
    }
  }' | jq
```

**When to use:** You want to alias the project's current title without knowing the repository path.

### 3. Brand Update Only

Update just the brand text (footer on OG cards):

```bash
curl -s -X POST https://assistant.ledger-mind.org/agent/run \
  -H "Content-Type: application/json" \
  -H "X-SiteAgent-Signature: sha256=<hmac>" \
  -d '{
    "plan": ["overrides.update", "og.generate", "status.write"],
    "params": {
      "brand": "LEO KLEMET — SITEAGENT"
    }
  }' | jq
```

**When to use:** You only want to change the brand text, not project names.

### 4. Bulk Update (Full Merge)

Update brand and multiple aliases at once:

```bash
curl -s -X POST https://assistant.ledger-mind.org/agent/run \
  -H "Content-Type: application/json" \
  -H "X-SiteAgent-Signature: sha256=<hmac>" \
  -d '{
    "plan": ["overrides.update", "og.generate", "status.write"],
    "params": {
      "overrides": {
        "brand": "LEO KLEMET — SITEAGENT",
        "title_alias": {
          "leo-portfolio": "siteAgent",
          "other-project": "Other Project"
        },
        "repo_alias": {
          "leok974/leo-portfolio": "siteAgent"
        }
      }
    }
  }' | jq
```

**When to use:** You want to update multiple projects and the brand in a single operation.

## Task Chaining

The `overrides.update` task is designed to be chained with other tasks:

### Recommended Chain
```json
{
  "plan": [
    "overrides.update",  // Update aliases
    "og.generate",       // Regenerate images with new names
    "status.write"       // Update siteAgent.json with new brand
  ],
  "params": { ... }
}
```

### Full Rebuild Chain
```json
{
  "plan": [
    "projects.sync",     // Fetch latest project data
    "overrides.update",  // Apply aliases
    "og.generate",       // Generate OG images
    "status.write"       // Update status
  ],
  "params": { ... }
}
```

## Response Format

The task returns:

```json
{
  "file": "./assets/data/og-overrides.json",
  "changed": {
    "brand": "LEO KLEMET — SITEAGENT",
    "title_alias": {
      "leo-portfolio": "siteAgent"
    },
    "repo_alias": {
      "leok974/leo-portfolio": "siteAgent"
    }
  },
  "brand": "LEO KLEMET — SITEAGENT"
}
```

## Local Development

In local development (without HMAC authentication), you can test directly:

```bash
# Update overrides locally
curl -s -X POST http://127.0.0.1:8001/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "plan": ["overrides.update", "og.generate"],
    "params": {
      "rename": {"repo": "leok974/leo-portfolio", "to": "siteAgent"}
    }
  }' | jq

# Verify the changes
cat assets/data/og-overrides.json | jq
```

## File Structure

The `og-overrides.json` file has the following structure:

```json
{
  "brand": "LEO KLEMET — SITEAGENT",
  "title_alias": {
    "project-name": "Display Name"
  },
  "repo_alias": {
    "org/repo": "Display Name"
  }
}
```

### Fields

- **`brand`** (string): Footer text on OG cards and site footer
- **`title_alias`** (object): Map project names to display names
- **`repo_alias`** (object): Map full repo paths to display names

### Priority Hierarchy

When rendering an OG card, the title is resolved in this order:

1. `repo_alias[full_repo_path]` (most specific)
2. `title_alias[project_name]`
3. `displayName` field from GitHub
4. `name` field from projects.json
5. `repo` field (fallback)

## Environment Variables

You can set a default brand via environment variable:

```bash
# In .env.prod or docker-compose.yml
SITEAGENT_BRAND="LEO KLEMET — SITEAGENT"
```

Priority: `og-overrides.json` > `SITEAGENT_BRAND` > default

## GitHub Workflow Integration

The overrides file is read automatically by the nightly workflow. To rename a project in production:

1. **Trigger a manual run** with the rename:
   ```bash
   gh workflow run siteagent-nightly.yml \
     -f plan='["overrides.update","og.generate","status.write"]' \
     -f params='{"rename":{"repo":"org/repo","to":"New Name"}}'
   ```

2. **Or use the API** (via GitHub Actions or curl with HMAC):
   ```bash
   curl -s -X POST https://assistant.ledger-mind.org/agent/run \
     -H "X-SiteAgent-Signature: sha256=$(echo -n '...' | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)" \
     -d '{"plan":["overrides.update","og.generate"],"params":{...}}'
   ```

## Use Cases

### Marketing Rebrand
Change all branding in one command:
```json
{"plan": ["overrides.update","og.generate","status.write"],
 "params": {"brand": "NEW BRAND — NEW TAGLINE"}}
```

### Project Launch
Rename a project before announcing:
```json
{"plan": ["overrides.update","og.generate"],
 "params": {"rename": {"repo":"org/project","to":"Product Name"}}}
```

### A/B Testing
Test different project names:
```json
// Version A
{"params": {"rename": {"from":"old-name","to":"Variant A"}}}

// Version B (later)
{"params": {"rename": {"from":"old-name","to":"Variant B"}}}
```

### Bulk Cleanup
Standardize all project names at once:
```json
{"params": {"overrides": {
  "title_alias": {
    "project-a": "Project A",
    "project-b": "Project B",
    "project-c": "Project C"
  }
}}}
```

## Notes

- **No default plan change**: The `overrides.update` task is not in the default agent plan. You must explicitly include it when calling `/agent/run`.
- **Preserves existing data**: Adding a new alias doesn't remove existing ones. The task merges changes.
- **Idempotent**: Running the same rename multiple times is safe.
- **No validation**: The task doesn't verify that projects exist. It will create aliases for any name you provide.

## Testing

Run the test suite to verify behavior:

```bash
pytest tests/test_overrides_update.py -v
```

Tests cover:
- Brand shortcut updates
- Rename by repo and by title
- Full merge operations
- Preserving existing aliases
- File creation if missing

## See Also

- [SITEAGENT_TASKS.md](./SITEAGENT_TASKS.md) - Complete task reference
- [MAINTENANCE_DASHBOARD.md](./MAINTENANCE_DASHBOARD.md) - Monitoring and reporting
- [../public/og/overrides.sample.json](../public/og/overrides.sample.json) - Sample configuration
