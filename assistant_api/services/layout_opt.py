"""Layout optimization service for project ordering."""
from __future__ import annotations

import json
import math
import pathlib
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from ..utils.text import slugify
from .artifacts import write_artifact
from .git_utils import make_diff
from .layout_weights import read_active

# Paths (adjust if your structure differs)
PROJECTS_PATH = pathlib.Path("projects.json")
LAYOUT_PATH = pathlib.Path("assets/layout.json")

# ---- Scoring knobs (tweak later or expose via config) ----
WEIGHTS = {
    "freshness": 0.35,  # recently updated projects → up
    "signal": 0.35,     # stars, forks, mentions, demo views
    "fit": 0.20,        # matches target roles / keywords
    "media": 0.10,      # has hi-quality cover / og
}

DECAY_HALF_LIFE_DAYS = 30  # freshness decay half-life

TARGET_ROLES = {"ai", "ml", "swe"}  # can be overridden per-run via payload
TARGET_KEYWORDS = {
    "ai": {"agent", "rag", "llm", "analytics", "data", "finance"},
    "ml": {"model", "training", "embedding", "vector", "anomaly"},
    "swe": {"fastapi", "react", "streaming", "docker", "e2e"},
}

# ---- Presets for different audiences ----
PRESETS = {
    "default": {
        "weights": {"freshness": 0.35, "signal": 0.35, "fit": 0.20, "media": 0.10},
        "roles": {"ai", "ml", "swe"},
        "sections": {"featured": 3},  # top 3
    },
    "recruiter": {
        # emphasize signals + media, less freshness
        "weights": {"freshness": 0.20, "signal": 0.45, "fit": 0.20, "media": 0.15},
        "roles": {"ai", "ml", "swe"},
        "sections": {"featured": 4},
    },
    "hiring_manager": {
        # emphasize fit + freshness (recent, relevant work)
        "weights": {"freshness": 0.40, "signal": 0.25, "fit": 0.25, "media": 0.10},
        "roles": {"ai", "ml", "swe"},
        "sections": {"featured": 3},
    },
}


def select_preset(name: str | None) -> dict[str, Any]:
    """Select a preset configuration by name."""
    return PRESETS.get(name or "default", PRESETS["default"])


@dataclass
class ProjectScore:
    """Score data for a single project."""
    slug: str
    score: float
    contributions: dict[str, float]
    rationale: list[str]


def _read_json(path: pathlib.Path) -> Any:
    """Read JSON file, return None if doesn't exist."""
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def _safe_float(x, default=0.0) -> float:
    """Safely convert value to float."""
    try:
        return float(x)
    except Exception:
        return default


def _freshness_score(updated_ts: float) -> float:
    """
    Calculate freshness score based on last update timestamp.

    Args:
        updated_ts: Unix timestamp (epoch seconds)

    Returns:
        Score from 0.0 to 1.0, where 1.0 is now and decays exponentially
    """
    now = time.time()
    days = max(0.0, (now - updated_ts) / 86400.0)
    # Exponential decay with half-life
    return 0.5 ** (days / DECAY_HALF_LIFE_DAYS)


def _signal_score(p: dict[str, Any]) -> float:
    """
    Calculate signal score from project metrics.

    Args:
        p: Project dict with stars, forks, demo_views, mentions

    Returns:
        Score roughly from 0.0 to 1.0 based on popularity
    """
    stars = _safe_float(p.get("stars", 0))
    forks = _safe_float(p.get("forks", 0))
    views = _safe_float(p.get("demo_views", 0))
    mentions = _safe_float(p.get("mentions", 0))  # blog/news/awards/etc

    # Simple log compression to normalize large ranges
    raw = stars * 2 + forks + views / 50 + mentions * 5
    return math.log1p(raw) / 5.0  # roughly 0..~1


def _fit_score(p: dict[str, Any], roles: set[str]) -> tuple[float, list[str]]:
    """
    Calculate role fit score based on keyword matches.

    Args:
        p: Project dict with title, tags, cats
        roles: Set of target roles (ai, ml, swe)

    Returns:
        Tuple of (score, rationale_list)
    """
    title = (p.get("title") or "").lower()
    tags = [t.lower() for t in p.get("tags", [])]
    cats = [c.lower() for c in p.get("cats", [])]
    text = " ".join([title, *tags, *cats])

    hits = 0
    rationales = []

    for role in roles:
        keywords = TARGET_KEYWORDS.get(role, set())
        for keyword in keywords:
            if keyword in text:
                hits += 1
                rationales.append(f"matches {role}:{keyword}")

    # Normalize roughly to 0..1 (8 hits = perfect fit)
    score = min(1.0, hits / 8.0)
    return score, rationales


def _media_score(p: dict[str, Any]) -> float:
    """
    Calculate media quality score.

    Args:
        p: Project dict with thumbnail/poster and ogImage/og_image

    Returns:
        1.0 if both cover and og present, 0.6 if one, 0.2 if none
    """
    cover = p.get("thumbnail") or p.get("poster")
    og = p.get("ogImage") or p.get("og_image")

    if cover and og:
        return 1.0
    elif cover or og:
        return 0.6
    else:
        return 0.2


def score_projects(projects: list[dict[str, Any]], roles: set, weights: dict[str, float]) -> list[ProjectScore]:
    """
    Score all projects and sort by descending score.

    Args:
        projects: List of project dicts
        roles: Set of target roles for fit scoring
        weights: Dict of scoring weights (freshness, signal, fit, media)

    Returns:
        List of ProjectScore objects, sorted by score (highest first)
    """
    out: list[ProjectScore] = []

    for p in projects:
        slug = p.get("slug") or slugify(p.get("title", "project"))

        # Get timestamp (support multiple field names)
        updated_ts = _safe_float(
            p.get("updated_ts") or
            p.get("updated_at_epoch") or
            p.get("updated_at") or
            0
        )

        # Calculate component scores
        freshness = _freshness_score(updated_ts) if updated_ts else 0.5
        signal = _signal_score(p)
        fit, fit_rationale = _fit_score(p, roles)
        media = _media_score(p)

        # Weighted total using provided weights
        score = (
            freshness * weights["freshness"] +
            signal * weights["signal"] +
            fit * weights["fit"] +
            media * weights["media"]
        )

        # Build rationale
        rationale = [
            f"freshness={freshness:.2f}",
            f"signal={signal:.2f}",
            f"fit={fit:.2f}",
            f"media={media:.2f}",
            *fit_rationale[:3]  # keep it short
        ]

        out.append(ProjectScore(
            slug=slug,
            score=score,
            contributions={
                "freshness": freshness,
                "signal": signal,
                "fit": fit,
                "media": media
            },
            rationale=rationale
        ))

    # Sort by score descending
    out.sort(key=lambda s: s.score, reverse=True)
    return out


def to_sections(scores: list[ProjectScore], featured_count: int) -> dict[str, list[str]]:
    """
    Split ordered projects into sections.

    Args:
        scores: Sorted list of ProjectScore objects
        featured_count: Number of projects for featured section

    Returns:
        Dict with 'featured' and 'more' lists of slugs
    """
    order = [s.slug for s in scores]
    featured = order[:featured_count]
    more = order[featured_count:]
    return {
        "featured": featured,
        "more": more,
    }


def propose_layout(scores: list[ProjectScore], featured_count: int = 3, preset_name: str = "default") -> dict[str, Any]:
    """
    Generate layout proposal from scores.

    Args:
        scores: List of ProjectScore objects (should be sorted)
        featured_count: Number of projects for featured section
        preset_name: Name of preset used

    Returns:
        Layout dict with order, sections, timestamp, and explanations
    """
    sections = to_sections(scores, featured_count)

    return {
        "version": 2,
        "preset": preset_name,
        "generated_at": int(time.time()),
        "order": [s.slug for s in scores],   # flat order for legacy readers
        "sections": sections,                # new: sections
        "explain": {
            s.slug: {
                "score": round(s.score, 3),
                "why": s.rationale,
                "parts": s.contributions
            }
            for s in scores
        }
    }


def run_layout_optimize(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Main entry point for layout.optimize task.

    Args:
        payload: Optional payload with preset, roles, featured_count

    Returns:
        Task result dict with artifact path, diff, summary
    """
    payload = payload or {}

    # Select preset and extract parameters
    preset = select_preset(payload.get("preset"))
    preset_name = payload.get("preset") or "default"
    roles = set(payload.get("roles") or preset["roles"])

    # Weight precedence: payload.weights > active weights > preset weights
    weights = payload.get("weights") or read_active() or preset["weights"]

    featured_count = int(payload.get("featured_count") or preset["sections"]["featured"])

    # Read projects
    projects_data = _read_json(PROJECTS_PATH) or []

    # Normalize to list format
    if isinstance(projects_data, dict):
        # Check if it's {"projects": [...]} wrapper
        if "projects" in projects_data:
            projects = projects_data["projects"]
        else:
            # Flat dict with slugs as keys: {"slug1": {...}, "slug2": {...}}
            projects = list(projects_data.values())
    elif isinstance(projects_data, list):
        projects = projects_data
    else:
        projects = []

    if not projects:
        return {
            "task": "layout.optimize",
            "error": "no_projects",
            "summary": "No projects found in projects.json"
        }

    # Score and propose layout
    scores = score_projects(projects, roles=roles, weights=weights)
    layout = propose_layout(scores, featured_count, preset_name)

    # Write artifact (preview) and proposed layout file
    artifact_path = write_artifact("layout-optimize.json", layout)

    # Ensure assets directory exists
    LAYOUT_PATH.parent.mkdir(exist_ok=True, parents=True)

    # Write proposed layout
    LAYOUT_PATH.write_text(
        json.dumps(layout, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    # Generate diff if possible
    diff = make_diff(str(LAYOUT_PATH))

    # Build summary
    featured_list = layout["sections"]["featured"]
    top_3 = ", ".join(featured_list[:3])
    summary = f"Featured={len(featured_list)}; top: {top_3}"

    return {
        "task": "layout.optimize",
        "preset": preset_name,
        "roles": sorted(list(roles)),
        "artifact": artifact_path,
        "proposed_file": str(LAYOUT_PATH),
        "diff": diff,
        "summary": summary,
        "top_projects": layout["order"][:5],
        "explain_top": {
            slug: layout["explain"][slug]
            for slug in layout["order"][:5]
            if slug in layout["explain"]
        }
    }
