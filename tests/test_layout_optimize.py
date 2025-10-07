"""Tests for layout optimization service."""
import pytest
from assistant_api.services.layout_opt import score_projects, propose_layout


def test_scoring_and_proposal():
    """Test that projects are scored and prioritized correctly."""
    projects = [
        {
            "slug": "siteagent",
            "title": "SiteAgent",
            "stars": 12,
            "forks": 1,
            "demo_views": 800,
            "mentions": 2,
            "updated_ts": 1700000000,
            "tags": ["ai", "agent", "fastapi"]
        },
        {
            "slug": "ledgermind",
            "title": "LedgerMind",
            "stars": 40,
            "forks": 5,
            "demo_views": 1200,
            "mentions": 3,
            "updated_ts": 1705000000,
            "tags": ["finance", "rag", "analytics"]
        },
        {
            "slug": "derma-ai",
            "title": "Derma AI",
            "stars": 8,
            "demo_views": 400,
            "updated_ts": 1690000000,
            "tags": ["ml", "vision"]
        },
    ]
    
    # Score projects with AI/SWE/ML roles
    scores = score_projects(projects, roles={"ai", "swe", "ml"})
    
    # Verify all projects scored
    assert len(scores) == 3
    
    # Extract order
    order = [s.slug for s in scores]
    
    # Should contain all projects
    assert "ledgermind" in order
    assert "siteagent" in order
    assert "derma-ai" in order
    
    # LedgerMind should be highly ranked (high stars, recent, good fit)
    assert order.index("ledgermind") < 2  # In top 2
    
    # Generate layout proposal
    layout = propose_layout(scores)
    
    # Verify structure
    assert isinstance(layout, dict)
    assert "version" in layout
    assert "order" in layout
    assert "explain" in layout
    assert isinstance(layout["order"], list)
    assert len(layout["order"]) == 3
    
    # Verify explanations exist for all projects
    for slug in layout["order"]:
        assert slug in layout["explain"]
        assert "score" in layout["explain"][slug]
        assert "why" in layout["explain"][slug]
        assert "parts" in layout["explain"][slug]


def test_empty_projects():
    """Test handling of empty projects list."""
    scores = score_projects([], roles={"ai"})
    assert scores == []
    
    layout = propose_layout(scores)
    assert layout["order"] == []
    assert layout["explain"] == {}


def test_role_fit_scoring():
    """Test that role keywords affect scoring."""
    projects = [
        {
            "slug": "ai-project",
            "title": "AI Agent System",
            "tags": ["ai", "agent", "rag", "llm"],
            "stars": 10,
            "updated_ts": 1700000000
        },
        {
            "slug": "generic-project",
            "title": "Generic Tool",
            "tags": ["tool", "utility"],
            "stars": 10,
            "updated_ts": 1700000000
        },
    ]
    
    # Score with AI role
    scores = score_projects(projects, roles={"ai"})
    
    # AI project should rank higher due to keyword matches
    order = [s.slug for s in scores]
    assert order[0] == "ai-project"
    
    # Check fit score is higher for AI project
    ai_score = next(s for s in scores if s.slug == "ai-project")
    generic_score = next(s for s in scores if s.slug == "generic-project")
    assert ai_score.contributions["fit"] > generic_score.contributions["fit"]


def test_freshness_decay():
    """Test that newer projects get higher freshness scores."""
    import time
    
    now = time.time()
    month_ago = now - (30 * 86400)  # 30 days ago
    year_ago = now - (365 * 86400)  # 365 days ago
    
    projects = [
        {
            "slug": "fresh",
            "title": "Fresh Project",
            "updated_ts": now,
            "stars": 5
        },
        {
            "slug": "month-old",
            "title": "Month Old",
            "updated_ts": month_ago,
            "stars": 5
        },
        {
            "slug": "year-old",
            "title": "Year Old",
            "updated_ts": year_ago,
            "stars": 5
        },
    ]
    
    scores = score_projects(projects, roles={"ai"})
    
    fresh = next(s for s in scores if s.slug == "fresh")
    month_old = next(s for s in scores if s.slug == "month-old")
    year_old = next(s for s in scores if s.slug == "year-old")
    
    # Freshness should decay over time
    assert fresh.contributions["freshness"] > month_old.contributions["freshness"]
    assert month_old.contributions["freshness"] > year_old.contributions["freshness"]
