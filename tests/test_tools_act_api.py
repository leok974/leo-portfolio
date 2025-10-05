from fastapi.testclient import TestClient
from assistant_api.main import app

client = TestClient(app)


def test_tools_list_basic():
    r = client.get("/api/tools")
    j = r.json()
    assert j.get("ok") is True
    tools = j.get("tools") or []
    names = {t.get("name") for t in tools if isinstance(t, dict)}
    # built-ins should be present
    assert {"search_repo", "read_file", "create_todo"}.issubset(names)


def test_act_endpoint_search_and_read():
    # Ask a question that triggers heuristic planner: search -> read
    body = {"question": "search SAFE_LIFESPAN and show file + lines"}
    r = client.post("/api/act", json=body)
    j = r.json()
    assert j.get("ok") is True
    steps = ((j.get("result") or {}).get("steps") or [])
    assert isinstance(steps, list) and len(steps) >= 1
    # first step should be search_repo and succeed
    first = steps[0]
    assert first.get("tool") == "search_repo"
    res = first.get("result") or {}
    assert res.get("ok") is True
    assert isinstance(res.get("hits"), list)


def test_act_endpoint_step_cap_two_max():
    # This question contains both search intent and a todo request; planner should cap to 2 steps
    body = {"question": "search SAFE_LIFESPAN and show file + lines; create todo: review LedgerMind docs"}
    r = client.post("/api/act", json=body)
    j = r.json()
    assert j.get("ok") is True
    steps = ((j.get("result") or {}).get("steps") or [])
    assert isinstance(steps, list)
    assert len(steps) <= 2  # safety cap
    names = [s.get("tool") for s in steps]
    # The cap should favor search_repo -> read_file chaining
    assert "search_repo" in names
    assert any(n in ("read_file",) for n in names)
