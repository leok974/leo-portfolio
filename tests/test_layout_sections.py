"""Tests for layout sections and presets."""
import pytest
from assistant_api.services.layout_opt import (
    score_projects,
    propose_layout,
    select_preset,
    to_sections,
    PRESETS
)


def _sample_projects():
    """Create sample projects for testing."""
    return [
        {
            "slug": "siteagent",
            "title": "SiteAgent",
            "stars": 12,
            "forks": 1,
            "demo_views": 800,
            "mentions": 2,
            "updated_ts": 1700000000,
            "tags": ["ai", "agent", "fastapi"],
            "stack": ["FastAPI", "React"]
        },
        {
            "slug": "ledgermind",
            "title": "LedgerMind",
            "stars": 40,
            "forks": 5,
            "demo_views": 1200,
            "mentions": 3,
            "updated_ts": 1705000000,
            "tags": ["finance", "rag", "analytics"],
            "stack": ["FastAPI", "PostgreSQL"]
        },
        {
            "slug": "derma-ai",
            "title": "Derma AI",
            "stars": 8,
            "demo_views": 400,
            "updated_ts": 1690000000,
            "tags": ["ml", "vision"],
            "stack": ["Python", "TensorFlow"]
        },
        {
            "slug": "datapipe",
            "title": "DataPipe AI",
            "stars": 16,
            "demo_views": 600,
            "updated_ts": 1708000000,
            "tags": ["ai", "pipeline"],
            "stack": ["Python", "Apache Airflow"]
        },
    ]


def test_preset_selection():
    """Test preset selection."""
    default = select_preset(None)
    assert default == PRESETS["default"]
    assert default["sections"]["featured"] == 3

    recruiter = select_preset("recruiter")
    assert recruiter == PRESETS["recruiter"]
    assert recruiter["sections"]["featured"] == 4
    assert recruiter["weights"]["signal"] == 0.45

    hm = select_preset("hiring_manager")
    assert hm == PRESETS["hiring_manager"]
    assert hm["weights"]["freshness"] == 0.40


def test_sections_default_preset():
    """Test scoring and sections with default preset."""
    preset = select_preset("default")
    projects = _sample_projects()

    scores = score_projects(projects, roles=preset["roles"], weights=preset["weights"])
    layout = propose_layout(scores, preset["sections"]["featured"], "default")

    assert "sections" in layout
    assert "featured" in layout["sections"]
    assert "more" in layout["sections"]
    assert len(layout["sections"]["featured"]) == preset["sections"]["featured"]

    # Check no overlap between sections
    featured_set = set(layout["sections"]["featured"])
    more_set = set(layout["sections"]["more"])
    assert featured_set.isdisjoint(more_set)

    # Check version 2
    assert layout["version"] == 2
    assert layout["preset"] == "default"


def test_recruiter_has_more_featured():
    """Test recruiter preset has 4 featured projects."""
    preset = select_preset("recruiter")
    projects = _sample_projects()

    scores = score_projects(projects, roles=preset["roles"], weights=preset["weights"])
    layout = propose_layout(scores, preset["sections"]["featured"], "recruiter")

    assert len(layout["sections"]["featured"]) == 4
    assert layout["preset"] == "recruiter"


def test_hiring_manager_biases_fit_freshness():
    """Test hiring_manager preset emphasizes fit and freshness."""
    hm = select_preset("hiring_manager")
    default = select_preset("default")
    projects = _sample_projects()

    scores_hm = score_projects(projects, roles=hm["roles"], weights=hm["weights"])
    scores_default = score_projects(projects, roles=default["roles"], weights=default["weights"])

    # Scores should differ due to weight differences
    slugs_hm = [s.slug for s in scores_hm]
    slugs_default = [s.slug for s in scores_default]

    # At least check that we have different ordering or scores
    # (Can't guarantee different order with small sample, but scores should vary)
    assert any(
        scores_hm[i].score != scores_default[i].score
        for i in range(len(scores_hm))
    )


def test_to_sections_split():
    """Test section splitting logic."""
    from assistant_api.services.layout_opt import ProjectScore

    scores = [
        ProjectScore(slug=f"proj{i}", score=1.0-i*0.1, contributions={}, rationale=[])
        for i in range(5)
    ]

    sections = to_sections(scores, featured_count=2)

    assert sections["featured"] == ["proj0", "proj1"]
    assert sections["more"] == ["proj2", "proj3", "proj4"]


def test_layout_explain_includes_all_projects():
    """Test that all projects have explanations."""
    preset = select_preset("default")
    projects = _sample_projects()

    scores = score_projects(projects, roles=preset["roles"], weights=preset["weights"])
    layout = propose_layout(scores, preset["sections"]["featured"], "default")

    # Check explain has all slugs
    for proj in projects:
        slug = proj["slug"]
        assert slug in layout["explain"]
        assert "score" in layout["explain"][slug]
        assert "why" in layout["explain"][slug]
        assert "parts" in layout["explain"][slug]


def test_weights_affect_scoring():
    """Test that different weights produce different scores."""
    projects = _sample_projects()

    # High signal weight
    signal_heavy = {"freshness": 0.1, "signal": 0.7, "fit": 0.1, "media": 0.1}
    scores_signal = score_projects(projects, roles={"ai", "ml", "swe"}, weights=signal_heavy)

    # High freshness weight
    fresh_heavy = {"freshness": 0.7, "signal": 0.1, "fit": 0.1, "media": 0.1}
    scores_fresh = score_projects(projects, roles={"ai", "ml", "swe"}, weights=fresh_heavy)

    # Different weights should produce different total scores
    assert scores_signal[0].score != scores_fresh[0].score


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
