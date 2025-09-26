import time
from fastapi.testclient import TestClient
from assistant_api.main import app
import assistant_api.llm_client as llm
import assistant_api.routes.llm as llm_routes

client = TestClient(app)


def _reset_primary_state():
    llm.PRIMARY_MODELS.clear()
    llm_routes.PRIMARY_MODELS.clear()
    llm.PRIMARY_MODEL_PRESENT = None
    llm_routes.PRIMARY_MODEL_PRESENT = None


def test_primary_model_present_after_startup(monkeypatch):
    _reset_primary_state()

    async def fake_list_models():
        return [llm.OPENAI_MODEL, 'other-model']

    # Patch both namespaces to avoid using original network implementation
    monkeypatch.setattr(llm, 'primary_list_models', fake_list_models, raising=True)
    monkeypatch.setattr(llm_routes, 'primary_list_models', fake_list_models, raising=True)

    deadline = time.time() + 5
    present = False
    last_payload = None
    while time.time() < deadline:
        r = client.get('/llm/models?refresh=1')
        assert r.status_code == 200
        last_payload = r.json()
        present = bool(last_payload.get('model_present'))
        if present:
            break
        time.sleep(0.2)

    assert last_payload is not None, 'No /llm/models response obtained'
    assert present is True, 'Primary model should be detected as present after startup refresh'
    assert last_payload.get('target') == llm.OPENAI_MODEL
