import os, sqlite3, json, importlib
from fastapi.testclient import TestClient


def make_bad_db(path: str):
    con = sqlite3.connect(path)
    cur = con.cursor()
    # Wrong schema: id INTEGER PRIMARY KEY
    cur.execute("CREATE TABLE chunks (id INTEGER PRIMARY KEY, text TEXT);")
    con.commit()
    con.close()


def make_client(tmp_path):
    db = tmp_path/"rag.sqlite"
    pj = tmp_path/"projects_knowledge.json"
    pj.write_text(json.dumps([{ "slug":"demo", "title":"Demo", "status":"in-progress" }]))

    os.environ['RAG_DB'] = str(db)
    os.environ['PROJECTS_JSON'] = str(pj)
    os.environ['ALLOW_TOOLS'] = '1'  # dev override
    os.environ['DEBUG_ERRORS'] = '1'

    # prepare bad db
    make_bad_db(str(db))

    from assistant_api import main
    from assistant_api.utils import auth
    importlib.reload(auth)
    importlib.reload(main)
    from assistant_api.main import app
    return TestClient(app)


def test_migration_then_ingest(tmp_path):
    c = make_client(tmp_path)

    # migration endpoint should fix schema and set user_version=1
    r = c.post('/api/rag/admin/migrate')
    assert r.status_code == 200
    assert r.json()['ok'] is True
    assert r.json()['user_version'] == 1

    # ingest should now succeed
    r = c.post('/api/rag/ingest/projects')
    if r.status_code != 200:
        print(f"Ingest failed with status {r.status_code}")
        print(f"Response: {r.json()}")
    assert r.status_code == 200
    assert r.json()['ingested'] >= 1
