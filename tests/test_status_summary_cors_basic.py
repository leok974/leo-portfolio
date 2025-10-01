import os, importlib
from fastapi.testclient import TestClient


def _client():
    os.environ['ALLOWED_ORIGINS'] = 'https://leok974.github.io, http://localhost:5173'
    import assistant_api.main as main
    importlib.reload(main)  # ensure CORS origins picked up
    return TestClient(main.app)


def test_status_summary_basic():
    c = _client()
    r = c.get('/status/summary')
    assert r.status_code == 200, r.text
    j = r.json()
    for k in ['llm','rag','ready']:
        assert k in j, f'missing {k}'
    assert 'path' in j['llm']


def test_status_summary_cors_header():
    c = _client()
    r = c.get('/status/summary', headers={'Origin':'https://leok974.github.io'})
    # Starlette test client sets ACAO only if matched
    acao = r.headers.get('access-control-allow-origin')
    assert acao in ('https://leok974.github.io','*'), acao
