"""Test weight proposal and approval workflow."""
import pytest
import pathlib
from assistant_api.services.layout_weights import (
    read_active,
    read_proposed,
    propose_weights,
    approve_weights,
    clear_proposed,
    ACTIVE_PATH,
    PROPOSED_PATH
)


@pytest.fixture(autouse=True)
def cleanup_weights():
    """Clean up weight files before and after each test."""
    for path in [ACTIVE_PATH, PROPOSED_PATH]:
        if path.exists():
            path.unlink()
    yield
    for path in [ACTIVE_PATH, PROPOSED_PATH]:
        if path.exists():
            path.unlink()


def test_propose_weights():
    """Test proposing new weights."""
    weights = {"freshness": 0.4, "signal": 0.3, "fit": 0.2, "media": 0.1}
    result = propose_weights(weights)
    
    assert result["status"] == "proposed"
    assert result["weights"] == weights
    
    # Should be saved to proposed path
    proposed = read_proposed()
    assert proposed == weights


def test_approve_weights():
    """Test approving proposed weights."""
    # First propose some weights
    weights = {"freshness": 0.4, "signal": 0.3, "fit": 0.2, "media": 0.1}
    propose_weights(weights)
    
    # Now approve them
    result = approve_weights()
    
    assert result["status"] == "approved"
    assert result["weights"] == weights
    
    # Should be moved to active
    active = read_active()
    assert active == weights
    
    # Proposed should be cleared
    assert read_proposed() is None


def test_approve_without_proposal():
    """Test approving when no proposal exists."""
    result = approve_weights()
    
    assert result["status"] == "error"
    assert "No proposed weights" in result["message"]


def test_clear_proposed():
    """Test clearing proposed weights."""
    # First propose some weights
    weights = {"freshness": 0.4, "signal": 0.3, "fit": 0.2, "media": 0.1}
    propose_weights(weights)
    
    # Now clear them
    result = clear_proposed()
    
    assert result["status"] == "cleared"
    assert read_proposed() is None
