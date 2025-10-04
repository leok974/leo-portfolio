import pytest
from httpx import AsyncClient, ASGITransport
from assistant_api.main import app

@pytest.mark.asyncio
async def test_metrics_csv_and_json():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # JSON
        rj = await ac.get("/api/metrics")
        assert rj.status_code == 200
        data = rj.json()
        assert data.get("ok") is True
        assert "metrics" in data and isinstance(data["metrics"], dict)

        # CSV
        rc = await ac.get("/api/metrics.csv")
        assert rc.status_code == 200
        assert "text/csv" in rc.headers.get("content-type", "")
        text = rc.text.strip()
        lines = text.splitlines()
        assert lines[0] == "stage,count,last_ms,last_backend"
        assert any(l.startswith(("embeddings,", "rerank,", "gen,")) for l in lines[1:])
