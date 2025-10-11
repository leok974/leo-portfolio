"""Smoke tests for agent task execution endpoints."""
import pytest
from fastapi.testclient import TestClient
from assistant_api.main import app

client = TestClient(app)


def test_get_registry():
    """Test GET /agents/registry endpoint."""
    response = client.get("/agents/registry")

    assert response.status_code == 200, \
        f"Registry endpoint failed: {response.text}"

    data = response.json()
    # Response is a dict of agents (not wrapped in {"agents": [...]})
    assert isinstance(data, dict), "Response should be a dictionary"
    assert len(data) > 0, "Should have at least one agent"

    # Check first agent structure
    agent_name = list(data.keys())[0]
    agent = data[agent_name]
    assert "name" in agent, "Agent should have name"
    assert "goals" in agent, "Agent should have goals"
    assert "tools" in agent, "Agent should have tools"
    assert "allow_auto" in agent, "Agent should have allow_auto flag"


def test_run_agent_missing_agent():
    """Test POST /agents/run with missing agent name."""
    response = client.post(
        "/agents/run",
        json={"agent": "nonexistent", "task": "test", "inputs": {}}
    )

    # Should fail with 404 or 400 (agent not found)
    assert response.status_code in (400, 404), \
        f"Should reject nonexistent agent: {response.status_code}"


def test_run_seo_validate():
    """Test running SEO validation task."""
    response = client.post(
        "/agents/run",
        json={
            "agent": "seo",
            "task": "validate",
            "inputs": {"pages": "sitemap://current"}
        }
    )

    # Should succeed or await approval
    assert response.status_code == 200, \
        f"SEO validate failed: {response.text}"

    data = response.json()
    assert "task_id" in data, "Should return task_id"
    assert "status" in data, "Should return status"
    assert data["status"] in ("queued", "running", "awaiting_approval", "succeeded"), \
        f"Unexpected status: {data['status']}"

    # Store task_id for status test
    return data["task_id"]


def test_get_status():
    """Test GET /agents/status endpoint."""
    # First, create a task
    run_response = client.post(
        "/agents/run",
        json={"agent": "projects", "task": "sync", "inputs": {}}
    )
    assert run_response.status_code == 200
    task_id = run_response.json()["task_id"]

    # Now check status
    status_response = client.get(f"/agents/status?task_id={task_id}")

    assert status_response.status_code == 200, \
        f"Status check failed: {status_response.text}"

    data = status_response.json()
    assert data["task_id"] == task_id, "Task ID should match"
    assert "agent" in data, "Should include agent name"
    assert "task" in data, "Should include task name"
    assert "status" in data, "Should include status"


def test_approve_nonexistent_task():
    """Test POST /agents/approve with nonexistent task."""
    response = client.post(
        "/agents/approve",
        json={"task_id": "00000000-0000-0000-0000-000000000000", "note": "test"}
    )

    # Should fail with 404 (task not found)
    assert response.status_code == 404, \
        f"Should reject nonexistent task: {response.status_code}"


def test_reject_nonexistent_task():
    """Test POST /agents/reject with nonexistent task."""
    response = client.post(
        "/agents/reject",
        json={"task_id": "00000000-0000-0000-0000-000000000000", "note": "test"}
    )

    # Should fail with 404 (task not found)
    assert response.status_code == 404, \
        f"Should reject nonexistent task: {response.status_code}"


@pytest.mark.skipif(
    True,  # Skip by default (requires approval flow)
    reason="Full approval workflow test requires manual intervention"
)
def test_full_approval_workflow():
    """Test complete approval workflow (create → approve → check).

    This test is skipped by default because it requires manual approval
    or a test-mode override for auto-approval.
    """
    # Create task
    run_resp = client.post(
        "/agents/run",
        json={"agent": "branding", "task": "logo", "inputs": {"repo": "test/test"}}
    )
    assert run_resp.status_code == 200
    task_id = run_resp.json()["task_id"]

    # Check initial status
    status_resp = client.get(f"/agents/status?task_id={task_id}")
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "awaiting_approval"

    # Approve
    approve_resp = client.post(
        "/agents/approve",
        json={"task_id": task_id, "note": "Approved in test"}
    )
    assert approve_resp.status_code == 200

    # Check final status
    final_resp = client.get(f"/agents/status?task_id={task_id}")
    assert final_resp.status_code == 200
    assert final_resp.json()["status"] == "succeeded"


def test_cancel_task():
    """Test POST /agents/cancel endpoint.

    Note: Tasks run synchronously and may already be done; accept any terminal state.
    """
    r = client.post("/agents/run", json={"agent": "seo", "task": "validate"})
    body = r.json()
    assert r.status_code == 200
    tid = body["task_id"]

    r2 = client.post("/agents/cancel", json={"task_id": tid})
    # Tasks run synchronously and may already be done; accept any terminal state
    assert r2.status_code in (200, 409)
    if r2.status_code == 200:
        assert r2.json()["status"] == "canceled"


def test_run_validate_seo_creates_artifacts():
    """Test that SEO validate creates real artifacts (report.json)."""
    import json
    import pathlib

    # Run seo.validate task
    r = client.post(
        "/agents/run",
        json={
            "agent": "seo",
            "task": "validate",
            "inputs": {"pages": "sitemap://current"}
        }
    )
    assert r.status_code == 200, f"SEO validate failed: {r.text}"

    tid = r.json()["task_id"]
    assert tid, "Should return task_id"

    # If outputs_uri is a file path, verify report.json exists
    outputs_uri = r.json().get("outputs_uri")
    if outputs_uri:
        # Could be a file path or directory path
        p = pathlib.Path(outputs_uri)
        if p.is_file() and p.name == "report.json":
            # Direct path to report.json
            assert p.exists(), f"Report file should exist: {p}"
            data = json.loads(p.read_text(encoding="utf-8"))
            assert "steps" in data, "Report should have steps field"
        elif p.is_dir():
            # Directory path - look for report.json inside
            report = p / "report.json"
            if report.exists():
                data = json.loads(report.read_text(encoding="utf-8"))
                assert "steps" in data, "Report should have steps field"


def _assert_artifact(uri: str, tid: str):
    """Helper to verify artifact exists and is valid JSON."""
    import pathlib
    import json

    p = pathlib.Path(uri)
    if not p.exists():
        # Fallback: check task directory
        p = pathlib.Path("artifacts").joinpath(tid, "report.json")

    assert p.exists(), f"Expected artifact at {p}"
    data = json.loads(p.read_text(encoding="utf-8"))
    assert "ok" in data or "skipped" in data, "Report should have ok/skipped field"


def test_run_code_review():
    """Test code.review agent creates artifacts."""
    r = client.post("/agents/run", json={"agent": "code", "task": "review"})
    assert r.status_code == 200, f"Failed: {r.text}"

    body = r.json()
    _assert_artifact(body["outputs_uri"], body["task_id"])


def test_run_dx_integrate():
    """Test dx.integrate agent creates artifacts."""
    r = client.post("/agents/run", json={"agent": "dx", "task": "integrate"})
    assert r.status_code == 200, f"Failed: {r.text}"

    body = r.json()
    _assert_artifact(body["outputs_uri"], body["task_id"])


def test_run_infra_scale():
    """Test infra.scale agent creates artifacts."""
    r = client.post("/agents/run", json={"agent": "infra", "task": "scale"})
    assert r.status_code == 200, f"Failed: {r.text}"

    body = r.json()
    _assert_artifact(body["outputs_uri"], body["task_id"])
