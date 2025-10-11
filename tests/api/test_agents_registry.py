"""Smoke tests for agent registry system."""
import pytest
from pathlib import Path
from assistant_api.agents.spec import load_registry, AgentSpec


def test_registry_file_exists():
    """Verify agents.yml exists at repo root."""
    root = Path(__file__).resolve().parents[2]  # Go up 2 levels: test file → tests → repo root
    registry_path = root / "agents.yml"
    assert registry_path.exists(), f"Registry file not found at {registry_path}"


def test_load_registry():
    """Verify registry loads successfully and contains expected agents."""
    reg = load_registry()

    # Should be a dict of agent specs
    assert isinstance(reg, dict)
    assert len(reg) > 0, "Registry should contain at least one agent"

    # Check for expected agents
    expected_agents = {"orchestrator", "projects", "seo", "branding", "content"}
    assert expected_agents.issubset(reg.keys()), \
        f"Missing expected agents. Got: {set(reg.keys())}"


def test_agent_spec_structure():
    """Verify agent specs have required fields."""
    reg = load_registry()

    for agent_name, spec in reg.items():
        # Should be an AgentSpec instance
        assert isinstance(spec, AgentSpec), \
            f"{agent_name} is not an AgentSpec instance"

        # Check required fields
        assert spec.name == agent_name, f"{agent_name}: name mismatch"
        assert isinstance(spec.goals, list), f"{agent_name}: goals should be a list"
        assert len(spec.goals) > 0, f"{agent_name}: should have at least one goal"
        assert isinstance(spec.tools, list), f"{agent_name}: tools should be a list"
        assert len(spec.tools) > 0, f"{agent_name}: should have at least one tool"
        assert isinstance(spec.allow_auto, bool), f"{agent_name}: allow_auto should be bool"


def test_seo_agent_exists():
    """Verify SEO agent is properly configured."""
    reg = load_registry()

    assert "seo" in reg, "SEO agent not found in registry"
    seo = reg["seo"]

    # Check SEO-specific goals
    assert "tune" in seo.goals or "validate" in seo.goals, \
        "SEO agent should have tune or validate goals"

    # Check SEO-specific tools
    assert any("seo" in tool.lower() for tool in seo.tools), \
        "SEO agent should have SEO-related tools"


def test_orchestrator_no_auto():
    """Verify orchestrator requires approval (safety check)."""
    reg = load_registry()

    assert "orchestrator" in reg, "Orchestrator not found in registry"
    orch = reg["orchestrator"]

    # Orchestrator should NEVER be allowed to auto-approve
    assert orch.allow_auto is False, \
        "Orchestrator must require human approval for safety"
