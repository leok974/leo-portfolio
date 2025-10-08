"""SEO PR automation service.

Creates GitHub PRs with SEO tune changes using git worktree isolation.
"""
from __future__ import annotations
import os
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Dict

from assistant_api.services.seo_tune import ARTIFACTS_DIR

try:
    from assistant_api.services.agent_events import emit_event
except Exception:  # pragma: no cover
    def emit_event(**kwargs):
        print("[agent_event]", kwargs)


class SeoPRConfigError(RuntimeError):
    """Raised when PR creation fails due to configuration issues."""
    pass


def _run(cmd: list[str], cwd: str | None = None) -> str:
    """Execute git command and return combined output."""
    try:
        p = subprocess.run(
            cmd,
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
            timeout=30
        )
        return (p.stdout or '') + (p.stderr or '')
    except subprocess.CalledProcessError as e:
        error_msg = f"Command failed: {' '.join(cmd)}\n{e.stderr}"
        raise RuntimeError(error_msg) from e
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f"Command timed out: {' '.join(cmd)}") from e


def open_seo_pr(
    base_branch: str = "main",
    branch_prefix: str = "seo/tune-"
) -> Dict:
    """Create a GitHub PR with SEO tune changes.
    
    Args:
        base_branch: Base branch to create PR against (default: "main")
        branch_prefix: Prefix for new branch name (default: "seo/tune-")
    
    Returns:
        Dict with keys:
            - ok: bool (success status)
            - branch: str (branch name)
            - pr: str | None (PR URL or None if gh CLI unavailable)
            - detail: str | None (additional info)
    
    Raises:
        SeoPRConfigError: If GITHUB_TOKEN not set
        FileNotFoundError: If seo-tune.diff not found
        RuntimeError: If git operations fail
    """
    # Validate configuration
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise SeoPRConfigError("GITHUB_TOKEN not set")

    # Validate artifacts
    diff_path = ARTIFACTS_DIR / "seo-tune.diff"
    reason_path = ARTIFACTS_DIR / "seo-tune.md"
    if not diff_path.exists():
        raise FileNotFoundError(
            "seo-tune.diff not found; run seo.tune first"
        )

    # Generate PR metadata
    timestamp = datetime.utcnow().strftime('%Y-%m-%d')
    title = f"SEO Tune — {timestamp}"
    body = (
        reason_path.read_text(encoding="utf-8")
        if reason_path.exists()
        else "Automated SEO tune."
    )
    branch = f"{branch_prefix}{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"

    emit_event(task="seo.pr", phase="start", branch=branch)

    # Ensure we're up to date
    repo_root = Path.cwd()
    _run(["git", "fetch", "--all", "--prune"])
    _run(["git", "checkout", base_branch])
    _run(["git", "pull", "origin", base_branch])

    # Create a temporary worktree for clean patch application
    with tempfile.TemporaryDirectory() as tmp:
        try:
            # Add worktree at base branch
            _run(["git", "worktree", "add", tmp, base_branch])
            
            # Create new branch in worktree
            _run(["git", "checkout", "-b", branch], cwd=tmp)
            
            # Apply the unified diff
            patch = diff_path.read_text(encoding="utf-8")
            patch_file = Path(tmp) / "seo.patch"
            patch_file.write_text(patch, encoding="utf-8")
            
            # Apply patch (may fail if patch doesn't apply cleanly)
            try:
                _run(["git", "apply", "seo.patch"], cwd=tmp)
            except RuntimeError as e:
                raise RuntimeError(
                    "Failed to apply patch. Changes may conflict with current state."
                ) from e
            
            # Stage and commit changes
            _run(["git", "add", "-A"], cwd=tmp)
            _run(["git", "commit", "-m", title], cwd=tmp)
            
            # Push using token auth
            origin_url = _run(["git", "remote", "get-url", "origin"], cwd=tmp).strip()
            
            # Inject token for HTTPS push
            if origin_url.startswith("https://") and "@" not in origin_url:
                origin_url = origin_url.replace(
                    "https://",
                    f"https://x-access-token:{token}@"
                )
                _run(["git", "remote", "set-url", "origin", origin_url], cwd=tmp)
            
            # Push branch
            _run(["git", "push", "-u", "origin", branch], cwd=tmp)
            
        finally:
            # Always clean up worktree
            try:
                _run(["git", "worktree", "remove", "--force", tmp])
            except Exception as e:
                print(f"[warn] Failed to remove worktree: {e}")

    # Create PR via gh CLI if available
    try:
        pr_out = _run([
            "gh", "pr", "create",
            "--base", base_branch,
            "--head", branch,
            "--title", title,
            "--body", body
        ])
        emit_event(task="seo.pr", phase="created", pr=pr_out)
        return {
            "ok": True,
            "branch": branch,
            "pr": pr_out.strip()
        }
    except Exception as e:
        # gh CLI not present or failed
        emit_event(task="seo.pr", phase="pushed", branch=branch)
        return {
            "ok": True,
            "branch": branch,
            "pr": None,
            "detail": "PR not created (gh missing or failed); branch pushed"
        }
