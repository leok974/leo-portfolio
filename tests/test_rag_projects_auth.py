import json
import os
import importlib
from fastapi.testclient import TestClient


# Import app after setting envs to ensure module reads them


def make_client(tmp_path):
    # point to temp DB + temp projects file
    db = tmp_path/"rag.sqlite"
    pj = tmp_path/"projects_knowledge.json"
    sample = [
        {"slug":"clarity","title":"Clarity","status":"in-progress","summary":"Chrome extension"}
    ]
    pj.write_text(json.dumps(sample))

    os.environ['RAG_DB'] = str(db)
    os.environ['PROJECTS_JSON'] = str(pj)

    # Reload modules to ensure they pick up env changes
    from assistant_api.utils import auth
    from assistant_api.routers import rag_projects
    from assistant_api import main
    importlib.reload(auth)
    importlib.reload(rag_projects)
    importlib.reload(main)
    from assistant_api.main import app
    return TestClient(app)


def test_ingest_requires_admin(tmp_path):
    c = make_client(tmp_path)
    r = c.post('/api/rag/ingest/projects')
    assert r.status_code == 403
    assert r.json()['detail'] == 'Admin required'


def test_update_requires_admin(tmp_path):
    c = make_client(tmp_path)
    r = c.post('/api/rag/projects/update', json={"slug":"demo","status":"completed"})
    assert r.status_code == 403


def test_nl_update_without_allow_tools(tmp_path, monkeypatch):
    """NL update endpoint should also deny by default."""
    monkeypatch.setenv('ALLOW_TOOLS', '0')
    c = make_client(tmp_path)
    r = c.post('/api/rag/projects/update_nl', json={"command": "set clarity to completed"})
    assert r.status_code == 403
    assert 'admin required' in r.json().get('detail', '').lower()


def test_admin_token_header_allows_access(tmp_path, monkeypatch):
    """X-Admin-Token header with ADMIN_TOKEN env should allow admin access."""
    monkeypatch.setenv('ALLOW_TOOLS', '0')
    monkeypatch.setenv('ADMIN_TOKEN', 'secret-xyz')
    c = make_client(tmp_path)

    # Test ingest endpoint
    r = c.post('/api/rag/ingest/projects', headers={"X-Admin-Token": "secret-xyz"})
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert data.get("by") == "token@admin"

    # Test structured update endpoint
    r = c.post('/api/rag/projects/update',
               json={"slug": "clarity", "status": "completed"},
               headers={"X-Admin-Token": "secret-xyz"})
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert data.get("by") == "token@admin"

    # Test NL update endpoint
    r = c.post('/api/rag/projects/update_nl',
               json={"instruction": "mark clarity completed"},
               headers={"X-Admin-Token": "secret-xyz"})
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert data.get("by") == "token@admin"


def test_allow_tools_override_enables_admin(tmp_path, monkeypatch):
    # enable override
    monkeypatch.setenv('ALLOW_TOOLS', '1')
    c = make_client(tmp_path)

    # ingest succeeds now
    r = c.post('/api/rag/ingest/projects')
    assert r.status_code == 200
    assert r.json()['ok'] is True

    # structured update works
    r = c.post('/api/rag/projects/update', json={"slug":"clarity","status":"completed"})
    assert r.status_code == 200

    # NL update works
    r = c.post('/api/rag/projects/update_nl', json={"instruction":"mark clarity in progress"})
    assert r.status_code == 200
