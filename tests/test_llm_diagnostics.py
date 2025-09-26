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


def test_models_refresh(monkeypatch):
    async def fake_list_models():
        return ['gpt-oss:20b', 'llama3:8b']

    _reset_primary_state()
    monkeypatch.setattr(llm_routes, 'primary_list_models', fake_list_models)
    response = client.get('/llm/models?refresh=1')
    assert response.status_code == 200
    payload = response.json()
    assert 'gpt-oss:20b' in payload['data']
    assert payload['target'] == llm.OPENAI_MODEL


def test_primary_ping_ok(monkeypatch):
    async def ok_chat(messages, max_tokens=1):  # noqa: ARG001
        return ({'choices': [{}]}, None, 200)

    monkeypatch.setattr(llm_routes, 'primary_chat', ok_chat)
    response = client.get('/llm/primary/ping')
    assert response.status_code == 200
    assert response.json()['ok'] is True


def test_primary_chat_latency(monkeypatch):
    async def ok_chat(messages, max_tokens=1):  # noqa: ARG001
        return ({'choices': [{}]}, None, 200)

    monkeypatch.setattr(llm_routes, 'primary_chat', ok_chat)
    response = client.get('/llm/primary/chat-latency?n=2')
    assert response.status_code == 200
    payload = response.json()
    assert payload.get('deprecated') is True
    assert payload.get('replacement') == '/llm/primary/latency'
    assert isinstance(payload.get('runs'), list)
    assert len(payload['runs']) == 2
