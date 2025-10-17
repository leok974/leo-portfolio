# pnpm Quick Reference

**Package Manager**: pnpm v10.15.1
**Workspace**: Monorepo with `apps/*` and `packages/*`

## Common Commands

### Installation
```powershell
# Install all dependencies
pnpm install

# Install with frozen lockfile (CI)
pnpm install --frozen-lockfile

# Add a dependency
pnpm add <package>
pnpm add -D <package>          # Dev dependency
pnpm add -w <package>          # To root workspace

# Remove a dependency
pnpm remove <package>
```

### Building
```powershell
# Build portfolio app
pnpm run build:portfolio

# Build siteagent app
pnpm run build:siteagent

# Build both (if script exists)
pnpm run build
```

### Development
```powershell
# Start dev server (default)
pnpm run dev

# Start portfolio dev server
pnpm run dev:portfolio

# Preview production build
pnpm run preview
```

### Testing
```powershell
# Run Vitest tests
pnpm run test
pnpm run test:watch

# Run E2E tests (Playwright)
pnpm run test:e2e
pnpm run test:e2e:ui
pnpm run test:e2e:debug

# Fast tests
pnpm run test:fast
pnpm run test:changed

# Eval tests
pnpm run eval:chat
pnpm run eval:plan
pnpm run eval:all
```

### Workspace Commands
```powershell
# Run command in all workspaces
pnpm -r run build

# Run command in specific workspace
pnpm --filter portfolio-ui run build
pnpm --filter siteagent-ui run dev

# Run command in workspace and dependencies
pnpm --filter portfolio-ui... run build
```

### Utility Commands
```powershell
# List installed packages
pnpm list
pnpm list --depth=0        # Only direct dependencies

# Show why a package is installed
pnpm why <package>

# Update dependencies
pnpm update
pnpm update <package>

# Check for outdated packages
pnpm outdated

# Prune node_modules (remove extraneous)
pnpm prune
```

### Scripts (from package.json)
```powershell
# Frontend
pnpm run build:portfolio
pnpm run build:siteagent
pnpm run dev:portfolio
pnpm run preview

# Testing
pnpm run test
pnpm run test:watch
pnpm run test:e2e
pnpm run e2e:ci
pnpm run e2e:smoke

# SEO & Analytics
pnpm run seo:tune
pnpm run seo:validate
pnpm run seo:lighthouse

# Agents
pnpm run agent:run
pnpm run agent:seo:validate
pnpm run agent:seo:tune

# Projects
pnpm run projects:sync
pnpm run projects:sync:dry

# Documentation
pnpm run docs:lint
pnpm run docs:links
pnpm run docs:audit

# DX Integration
pnpm run dx:integrate
pnpm run dx:report

# Infrastructure
pnpm run infra:scale
pnpm run infra:apply
pnpm run infra:rollback
```

## npm vs pnpm Command Comparison

| npm | pnpm |
|-----|------|
| `npm install` | `pnpm install` |
| `npm ci` | `pnpm install --frozen-lockfile` |
| `npm install <pkg>` | `pnpm add <pkg>` |
| `npm uninstall <pkg>` | `pnpm remove <pkg>` |
| `npm update` | `pnpm update` |
| `npm run <script>` | `pnpm run <script>` or `pnpm <script>` |
| `npm list` | `pnpm list` |
| `npm outdated` | `pnpm outdated` |
| `npm audit` | `pnpm audit` |

## Workspace-Specific Features

### Filtering
```powershell
# Run in all workspaces
pnpm -r <command>

# Run in specific workspace
pnpm --filter <workspace> <command>

# Run in workspace and its dependencies
pnpm --filter <workspace>... <command>

# Run in workspace's dependents
pnpm --filter ...<workspace> <command>
```

### Examples
```powershell
# Build only portfolio-ui
pnpm --filter portfolio-ui run build

# Test all workspaces in parallel
pnpm -r run test

# Add dependency to specific workspace
pnpm --filter portfolio-ui add axios

# Add dependency to root
pnpm add -w prettier
```

## Troubleshooting

### Clear Cache
```powershell
pnpm store prune
```

### Rebuild Dependencies
```powershell
pnpm rebuild
```

### Approve Build Scripts (for native modules)
```powershell
pnpm approve-builds
```

### Fix Peer Dependency Issues
```powershell
# Option 1: Allow auto-install peers
echo "auto-install-peers=true" >> .npmrc

# Option 2: Disable strict checking
echo "strict-peer-dependencies=false" >> .npmrc
```

### Remove and Reinstall
```powershell
Remove-Item node_modules, pnpm-lock.yaml -Recurse -Force
pnpm install
```

## Configuration (.npmrc)

Create `.npmrc` in project root for custom settings:

```ini
# Auto-install peer dependencies
auto-install-peers=true

# Disable strict peer dependency checking
strict-peer-dependencies=false

# Hoist patterns (make specific packages available to all)
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
public-hoist-pattern[]=*typescript*

# Store location (optional)
store-dir=~/.pnpm-store

# Shamefully hoist (last resort for compatibility)
# shamefully-hoist=true
```

## Benefits Over npm

1. **Speed**: ~2x faster installs (10.6s vs 20-30s)
2. **Disk Space**: Shared global store, symlinked packages
3. **Security**: Build script approval system
4. **Strictness**: Prevents phantom dependencies
5. **Monorepo**: Better workspace support and filtering

## Documentation

- [pnpm Official Docs](https://pnpm.io/)
- [Workspace Guide](https://pnpm.io/workspaces)
- [CLI Reference](https://pnpm.io/cli/install)
- [Migration Guide](./PNPM_MIGRATION_COMPLETE.md)

---

**Last Updated**: October 16, 2025
**pnpm Version**: 10.15.1
