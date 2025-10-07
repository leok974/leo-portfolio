import json, os, importlib
from fastapi.testclient import TestClient


def make_client(tmp_path):
    # Temp DB + projects file
    db = tmp_path/"rag.sqlite"
    pj = tmp_path/"projects_knowledge.json"
    pj.write_text(json.dumps([{ "slug":"demo", "title":"Demo", "status":"in-progress" }]))

    os.environ['RAG_DB'] = str(db)
    os.environ['PROJECTS_JSON'] = str(pj)
    # Don't set ALLOW_TOOLS here - let tests control it

    from assistant_api import main
    from assistant_api.utils import auth
    importlib.reload(auth)
    importlib.reload(main)
    from assistant_api.main import app
    return TestClient(app)


def test_diag_requires_admin(tmp_path):
    os.environ['ALLOW_TOOLS'] = '0'
    if 'ADMIN_TOKEN' in os.environ:
        del os.environ['ADMIN_TOKEN']
    c = make_client(tmp_path)
    r = c.get('/api/rag/diag/rag')
    assert r.status_code == 403


def test_diag_with_allow_tools(tmp_path, monkeypatch):
    monkeypatch.setenv('ALLOW_TOOLS', '1')
    if 'ADMIN_TOKEN' in os.environ:
        monkeypatch.delenv('ADMIN_TOKEN')
    c = make_client(tmp_path)
    r = c.get('/api/rag/diag/rag')
    assert r.status_code == 200
    body = r.json()
    assert body['ok'] is True
    assert 'env' in body and 'files' in body


def test_diag_with_admin_token(tmp_path, monkeypatch):
    monkeypatch.setenv('ALLOW_TOOLS', '0')
    monkeypatch.setenv('ADMIN_TOKEN', 'secret-xyz')
    c = make_client(tmp_path)
    r = c.get('/api/rag/diag/rag', headers={'X-Admin-Token':'secret-xyz'})
    assert r.status_code == 200
    body = r.json()
    assert body['ok'] is True
    assert 'rag_db' in body['files']
