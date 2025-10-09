"""Agent Act - Autonomous PR Generator

Endpoint for creating GitHub PRs from artifacts in /agent/artifacts/**.
Protected by SITEAGENT_ENABLE_WRITE=1 environment variable.

Features:
- Branch reuse per category (siteagent/seo, siteagent/content, etc.)
- Updates existing PRs instead of creating duplicates
- Single-commit rolling branches for clean history
"""
from __future__ import annotations
import os
import json
import subprocess
from pathlib import Path
from typing import Optional, Tuple
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/agent", tags=["agent"])

ARTIFACTS_DIR = Path("agent/artifacts")


# ============ Models ============

class PRCreateInput(BaseModel):
    """Input for PR creation."""
    branch: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    labels: list[str] = ["auto", "siteagent"]
    base: str = "main"
    commit_message: Optional[str] = None
    dry_run: bool = False
    use_llm: bool = False  # Enable LLM-generated title/body
    attach_insights: bool = True  # Append analytics insights to PR body
    category: Optional[str] = None  # Logical stream (seo/content/og/deps/misc)
    single_commit: bool = True  # Keep branch as single rolling commit
    force_with_lease: bool = True  # Safe force push when updating


class PRCreateResponse(BaseModel):
    """Response from PR creation."""
    status: str
    branch: Optional[str] = None
    pr: Optional[str] = None
    labels: Optional[list[str]] = None
    diff: Optional[str] = None
    message: Optional[str] = None


# ============ Guards ============

def _dev_guard():
    """Verify SITEAGENT_ENABLE_WRITE=1 is set."""
    if os.getenv("SITEAGENT_ENABLE_WRITE") != "1":
        raise HTTPException(
            status_code=403,
            detail="Write actions disabled. Set SITEAGENT_ENABLE_WRITE=1 to enable."
        )


# ============ Helpers ============

def _run(cmd: str, env: dict | None = None) -> str:
    """Run shell command and return stdout."""
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        env={**os.environ, **(env or {})}
    )
    if result.returncode != 0:
        raise Exception(
            f"Command failed: {cmd}\n"
            f"STDOUT: {result.stdout}\n"
            f"STDERR: {result.stderr}"
        )
    return result.stdout.strip()


def _ensure_gh():
    """Verify GitHub CLI is installed."""
    try:
        _run("gh --version")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="GitHub CLI (gh) not found. Install from https://cli.github.com/"
        ) from e


def _require_token() -> str:
    """Get GitHub token from environment."""
    tok = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
    if not tok:
        raise HTTPException(
            status_code=500,
            detail="GITHUB_TOKEN or GH_TOKEN environment variable required"
        )
    return tok


def _repo_slug() -> str:
    """
    Get repository owner/name slug.
    Tries GITHUB_REPOSITORY env var first (set by Actions),
    then parses from git remote.
    """
    slug = os.getenv("GITHUB_REPOSITORY")
    if slug:
        return slug

    try:
        remote = _run("git config --get remote.origin.url")
        # Parse github.com:owner/repo.git or https://github.com/owner/repo.git
        if "github.com" in remote:
            parts = remote.replace(".git", "").split("github.com")[-1]
            return parts.strip("/:").strip()
    except Exception:
        pass

    raise HTTPException(
        status_code=500,
        detail="Could not determine repository slug. Set GITHUB_REPOSITORY env var."
    )


def _collect_artifacts(root: Path = ARTIFACTS_DIR) -> list[Path]:
    """Collect current artifact files; no caching, skip missing."""
    if not root.exists():
        return []
    files: list[Path] = []
    for p in root.rglob("*"):
        if p.is_file():
            files.append(p)
    return files


def _category_from_labels(labels: list[str] | None) -> str:
    """Extract category from labels, defaulting to 'misc'."""
    labels = labels or []
    known = ["seo", "og", "deps", "content", "misc"]
    for c in known:
        if c in labels:
            return c
    return "misc"


def _branch_for_category(payload: PRCreateInput) -> str:
    """Determine branch name from category or explicit branch."""
    if payload.branch:
        return payload.branch
    cat = (payload.category or _category_from_labels(payload.labels)).strip().replace(" ", "-")
    return f"siteagent/{cat or 'misc'}"


def _find_open_pr_for_branch(repo: str, branch: str, token: str) -> Tuple[Optional[int], Optional[str]]:
    """Find open PR with given head branch. Returns (pr_number, pr_url) or (None, None)."""
    try:
        env = {"GH_TOKEN": token}
        out = _run(f'gh pr list --repo {repo} --state open --head "{branch}" --json number,url', env=env)
        arr = json.loads(out)
        if arr and len(arr) > 0:
            return arr[0]["number"], arr[0]["url"]
    except Exception:
        pass
    return None, None


def _comment_on_pr(repo: str, pr_number: int, comment: str, token: str):
    """Add a comment to an existing PR."""
    try:
        env = {"GH_TOKEN": token}
        # Escape double quotes in comment
        safe_comment = comment.replace('"', '\\"')
        _run(f'gh pr comment {pr_number} --repo {repo} --body "{safe_comment}"', env=env)
    except Exception:
        pass


def _read_insights_md() -> str:
    """Read analytics insights markdown file if it exists."""
    try:
        insight_file = Path("analytics/outputs/insight-summary.md")
        if insight_file.exists():
            return insight_file.read_text(encoding="utf-8")
    except Exception:
        pass
    return ""


def _default_title_body(diff_summary: str) -> tuple[str, str]:
    """Generate default PR title and body from diff."""
    file_count = len([l for l in diff_summary.split("\n") if l.strip()])
    title = f"chore(siteagent): apply {file_count} artifact(s)"
    body = (
        "This PR was automatically generated by SiteAgent.\n\n"
        "## Changes\n\n"
        f"```\n{diff_summary}\n```\n"
    )
    return title, body


def _llm_title_body(diff_summary: str, insights: str = "") -> tuple[str, str]:
    """Generate PR title and body using LLM (with primary→fallback routing)."""
    try:
        from assistant_api.llm.router import chat_complete
    except ImportError:
        # Fall back to default if LLM router not available
        return _default_title_body(diff_summary)

    prompt = (
        "Create a concise PR title (<=72 chars) and a short PR body.\n"
        "Return format:\nTITLE: <one line>\nBODY:\n<short markdown body>\n\n"
        f"Diff summary:\n```\n{diff_summary}\n```\n\n"
        f"Latest analytics insight (optional):\n```\n{insights[:4000]}\n```"
    )

    try:
        model_used, text = chat_complete(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )

        lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
        title_line = next(
            (ln[7:].strip() for ln in lines if ln.upper().startswith("TITLE:")),
            lines[0] if lines else "chore: update",
        )
        body_start = next(
            (i for i, ln in enumerate(lines) if ln.upper().startswith("BODY:")), None
        )
        body_lines = lines[body_start + 1 :] if body_start is not None else lines[1:]

        title = title_line[:72] or "chore: update"
        body = "\n".join(body_lines).strip() or "Auto-generated by SiteAgent."

        # Append which model was used
        body += f"\n\n<sub>LLM: {model_used}</sub>"

        return title, body
    except Exception as e:
        # Fall back to default on any LLM error
        print(f"[warn] LLM title/body generation failed: {e}")
        return _default_title_body(diff_summary)


# ============ Routes ============

@router.post("/act", dependencies=[Depends(_dev_guard)])
def agent_act(
    task: str,
    payload: PRCreateInput = Body(default=PRCreateInput())
):
    """
    Agent action dispatcher.

    Currently supports:
    - task=pr.create: Create GitHub PR from artifacts
    """
    if task == "pr.create":
        return create_pr(payload)

    raise HTTPException(
        status_code=400,
        detail=f"Unknown task: {task}"
    )


@router.post("/artifacts/pr", dependencies=[Depends(_dev_guard)])
def pr_alias(payload: PRCreateInput = Body(default=PRCreateInput())):
    """Alias for /agent/act?task=pr.create"""
    return create_pr(payload)


def create_pr(payload: PRCreateInput) -> dict:
    """
    Create or update a GitHub PR from artifacts in /agent/artifacts/**.

    Features:
    - Branch reuse per category (siteagent/seo, siteagent/content, etc.)
    - Updates existing PRs instead of creating duplicates
    - Single-commit rolling branches for clean history
    - Optional LLM-generated titles/bodies with analytics insights

    Protected by SITEAGENT_ENABLE_WRITE=1 environment variable.

    Returns:
    - For dry_run=true: branch name, diff summary, suggested title/body
    - For dry_run=false: status (created/updated/noop), PR URL, branch, labels, diff
    """
    # Verify gh CLI is installed
    _ensure_gh()

    # Get repo slug and token (required for non-dry-run)
    repo = _repo_slug() if not payload.dry_run else None
    tok = _require_token() if not payload.dry_run else None
    env = {"GH_TOKEN": tok} if tok else {}

    # Determine branch from category or explicit name
    branch = _branch_for_category(payload)

    # Fetch latest and create/update branch from base
    try:
        _run("git fetch origin")
        _run(f"git checkout -B {branch} origin/{payload.base}")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to checkout branch {branch}: {str(e)}"
        ) from e

    # Collect and copy artifacts
    files = _collect_artifacts()
    if not files:
        raise HTTPException(
            status_code=400,
            detail=f"No artifacts found in {ARTIFACTS_DIR}. Nothing to commit."
        )

    repo_root = Path(".").resolve()
    for f in files:
        if not f.exists():
            continue
        try:
            rel = f.relative_to(ARTIFACTS_DIR)
            out = repo_root / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(f.read_bytes())
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to copy artifact {f}: {str(e)}"
            ) from e

    # Stage changes and get diff summary
    try:
        _run("git add -A")
        diff_summary = _run("git status --porcelain")
    except Exception as e:
        diff_summary = f"(diff summary unavailable: {e})"

    # Check if there are actually changes
    if not diff_summary:
        # No changes - check if PR exists
        if not payload.dry_run and tok and repo:
            pr_num, pr_url = _find_open_pr_for_branch(repo, branch, tok)
            return {
                "status": "noop",
                "message": "No changes to commit.",
                "branch": branch,
                "open_pr": pr_url
            }
        return {
            "status": "noop",
            "message": "No changes to commit.",
            "branch": branch
        }

    # Generate PR title and body (LLM or default)
    insights_md = _read_insights_md() if payload.attach_insights else ""
    title = payload.title
    body = payload.body

    if not title or not body:
        if payload.use_llm:
            t, b = _llm_title_body(diff_summary, insights_md)
        else:
            t, b = _default_title_body(diff_summary)
        title = title or t
        body = body or b

    # Append insights to body if requested
    if payload.attach_insights and insights_md and insights_md not in (body or ""):
        body += "\n\n---\n\n### Analytics Insight\n" + insights_md

    # Dry run: return without pushing/PR
    if payload.dry_run:
        return {
            "status": "dry-run",
            "branch": branch,
            "diff": diff_summary,
            "suggested_title": title,
            "suggested_body": body,
            "labels": payload.labels or ["auto", "siteagent"]
        }

    # Commit changes (single rolling commit or append)
    commit_msg = payload.commit_message or f"chore(siteagent): update {branch.split('/', 1)[-1]}"
    safe_msg = commit_msg.replace('"', '\\"')

    if payload.single_commit:
        # Reset to base, then create single squashed commit for clean history
        try:
            _run(f"git reset --soft origin/{payload.base}")
            _run(f'git commit -m "{safe_msg}"')
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create single commit: {str(e)}"
            ) from e
    else:
        # Normal append commit
        try:
            _run(f'git commit -m "{safe_msg}"')
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to commit changes: {str(e)}"
            ) from e

    # Push branch (force-with-lease for single-commit, normal for append)
    try:
        push_flags = "--force-with-lease" if payload.single_commit and payload.force_with_lease else ""
        _run(f"git push -u origin {branch} {push_flags}".strip(), env=env)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to push branch {branch}: {str(e)}"
        ) from e

    # Check if PR already exists for this branch
    pr_num, pr_url = _find_open_pr_for_branch(repo, branch, tok)

    # Prepare labels
    category = branch.split("/", 1)[-1] if "/" in branch else "misc"
    labels = payload.labels or ["auto", "siteagent", category]

    if pr_num:
        # Update existing PR: add labels and comment with diff summary
        try:
            label_str = ",".join(labels)
            _run(f'gh pr edit {pr_num} --repo {repo} --add-label "{label_str}"', env=env)
        except Exception:
            pass  # Labels may already exist

        try:
            comment = f"🤖 SiteAgent updated branch **{branch}**\n\n```\n{diff_summary[:2000]}\n```"
            _comment_on_pr(repo, pr_num, comment, tok)
        except Exception:
            pass  # Comment is nice-to-have

        return {
            "status": "updated",
            "branch": branch,
            "pr": pr_url,
            "labels": labels,
            "diff": diff_summary,
            "message": f"Updated existing PR #{pr_num}"
        }

    # Create new PR
    try:
        safe_title = title.replace('"', '\\"')
        safe_body = body.replace('"', '\\"').replace('\n', '\\n')
        
        # Check if 'draft' label is present to open PR as draft
        is_draft = any(lbl.lower() == "draft" for lbl in labels)
        draft_flag = "--draft" if is_draft else ""
        
        pr_url = _run(
            f'gh pr create --repo {repo} --base {payload.base} --head {branch} '
            f'--title "{safe_title}" --body "{safe_body}" {draft_flag}'.strip(),
            env=env
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create PR: {str(e)}"
        ) from e

    # Add labels to new PR
    try:
        label_str = ",".join(labels)
        _run(f'gh pr edit {pr_url} --add-label "{label_str}"', env=env)
    except Exception:
        pass  # Labels are nice-to-have

    return {
        "status": "created",
        "branch": branch,
        "pr": pr_url,
        "labels": labels,
        "diff": diff_summary,
        "message": "Created new PR"
    }
