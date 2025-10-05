from assistant_api.tools.search_repo import run_search_repo
from assistant_api.tools.read_file import run_read_file

def test_search_repo_basic():
    out = run_search_repo({"query": "LedgerMind", "k": 5})
    assert out["ok"] and isinstance(out.get("hits"), list)

def test_read_file_slice():
    out = run_search_repo({"query": "SAFE_LIFESPAN", "k": 1})
    assert out.get("hits")
    path = out["hits"][0]["path"]
    slice_out = run_read_file({"path": path, "start": 1, "end": 20})
    assert slice_out["ok"] and "content" in slice_out
