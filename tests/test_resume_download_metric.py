from assistant_api.main import app
from fastapi.testclient import TestClient


def test_resume_download_metric(monkeypatch, tmp_path):
    # create a fake resume file
    resume = tmp_path / "resume.pdf"
    resume.write_bytes(b"%PDF-1.4 fake")
    monkeypatch.setenv("RESUME_PATH", str(resume))

    c = TestClient(app)
    r = c.get("/dl/resume")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")

    # metrics should include resume_download_total
    m = c.get("/metrics").text
    assert "resume_download_total" in m
