"""PR utilities for creating GitHub pull requests."""

from __future__ import annotations

import os
import subprocess
from typing import Any, Dict


def git_commit(file_path: str, message: str) -> str:
    """
    Commit a file to git.

    Args:
        file_path: Path to file to commit
        message: Commit message

    Returns:
        Commit hash
    """
    subprocess.run(["git", "add", file_path], check=False)
    result = subprocess.run(
        ["git", "commit", "-m", message], check=False, capture_output=True, text=True
    )

    # Get commit hash
    hash_result = subprocess.run(
        ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=False
    )
    return (hash_result.stdout or "").strip()


def open_pr_via_cli(branch: str, title: str, body: str) -> dict[str, Any]:
    """
    Open a PR using GitHub CLI.

    Args:
        branch: Branch name
        title: PR title
        body: PR body

    Returns:
        Result dict with success status
    """
    # Push branch
    push_result = subprocess.run(
        ["git", "push", "-u", "origin", branch],
        check=False,
        capture_output=True,
        text=True,
    )

    if push_result.returncode != 0:
        return {"ok": False, "error": "git_push_failed", "details": push_result.stderr}

    # Create PR via gh CLI
    pr_result = subprocess.run(
        ["gh", "pr", "create", "--fill", "--title", title, "--body", body],
        check=False,
        capture_output=True,
        text=True,
    )

    if pr_result.returncode != 0:
        return {
            "ok": False,
            "error": "gh_pr_create_failed",
            "details": pr_result.stderr,
        }

    return {"ok": True, "url": pr_result.stdout.strip()}


def open_pr_via_api(
    base_branch: str = "main",
    head_branch: str | None = None,
    title: str = "",
    body: str = "",
) -> dict[str, Any]:
    """
    Open a PR using GitHub API.

    Args:
        base_branch: Base branch (default: "main")
        head_branch: Head branch name
        title: PR title
        body: PR body

    Returns:
        Result dict with success status and PR details
    """
    import requests

    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("GITHUB_REPO")  # e.g. "leok974/leo-portfolio"

    if not token or not repo or not head_branch:
        return {
            "ok": False,
            "reason": "missing_token_or_repo",
            "details": f"token={bool(token)}, repo={bool(repo)}, head_branch={bool(head_branch)}",
        }

    # Push branch first
    push_result = subprocess.run(
        ["git", "push", "-u", "origin", head_branch],
        check=False,
        capture_output=True,
        text=True,
    )

    if push_result.returncode != 0:
        return {"ok": False, "error": "git_push_failed", "details": push_result.stderr}

    # Create PR via API
    url = f"https://api.github.com/repos/{repo}/pulls"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }
    data = {
        "title": title,
        "body": body,
        "head": head_branch,
        "base": base_branch,
        "maintainer_can_modify": True,
    }

    try:
        response = requests.post(url, headers=headers, json=data, timeout=15)
        response.raise_for_status()
        pr_data = response.json()

        return {
            "ok": True,
            "status": response.status_code,
            "pr_number": pr_data.get("number"),
            "pr_url": pr_data.get("html_url"),
            "pr_data": pr_data,
        }
    except requests.RequestException as e:
        return {
            "ok": False,
            "error": "api_request_failed",
            "details": str(e),
            "status": (
                getattr(e.response, "status_code", None)
                if hasattr(e, "response")
                else None
            ),
        }
