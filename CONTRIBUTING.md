# Contributing Guide

Thank you for considering a contribution!

## Workflow
1. Fork / branch from `main`.
2. Create focused commits (logical units).
3. Run tests & smoke scripts locally.
4. Update documentation (see Docs Responsibilities).
5. Open PR referencing any related issues.

## Docs Responsibilities
For any change that:
- Adds or modifies endpoints → update `README.md` + `docs/API.md`.
- Alters deployment / services → update `docs/DEPLOY.md`.
- Impacts architecture or data flow → update `docs/ARCHITECTURE.md`.
- Adds security controls → update `docs/SECURITY.md`.
- Adds tests or tooling → update `docs/DEVELOPMENT.md`.
- User-facing feature / fix → append `docs/CHANGELOG.md` (unreleased section or bump version in PR).

## Dev Environment
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r assistant_api/requirements.txt
pytest -q
```

## Commit Message Style
- Use concise prefixes: feat:, fix:, docs:, chore:, refactor:, perf:, test:
- Deployment infra: deploy:
- Multi-file doc additions: docs:

Example:
```
feat: add streaming metadata event for provider attribution
```

## Coding Guidelines
- Favor small pure functions for metrics and health code.
- Keep API responses stable; mark deprecations with `deprecated: true` and specify `replacement`.
- Avoid leaking provider exceptions directly; always normalize error shape.

## Testing
- Add at least one test for each new endpoint or critical branch.
- Use existing smoke scripts (`scripts/smoke.ps1` / `.sh`) for quick health validation.

## Security
- Never commit real API keys or secrets.
- Validate CORS origin additions.
- Run `pip-audit` before large dependency bumps.

## Review Checklist (Maintainers)
- [ ] Docs updated
- [ ] Changelog entry present
- [ ] Tests pass locally
- [ ] No secrets / credentials
- [ ] Fallback mode still functions if primary disabled

## Releasing
1. Update version in `docs/CHANGELOG.md` (create new section).
2. Tag: `git tag vX.Y.Z && git push --tags`.
3. (Optional) Publish backend image (future GHCR workflow).

## Questions / Help
Open a discussion or issue with reproduction steps, logs, and environment details.
