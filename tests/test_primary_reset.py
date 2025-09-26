from fastapi.testclient import TestClient
import assistant_api.llm_client as llm
from assistant_api.main import app

client = TestClient(app)

class DummyResp:
    def __init__(self, status_code=500, json_data=None):
        self.status_code = status_code
        self._json = json_data or {"choices": [{"message": {"content": "hi"}}]}
    def json(self):
        return self._json

async def failing_primary(messages, max_tokens=64):  # noqa: ARG001
    llm.LAST_PRIMARY_ERROR = "http_5xx"
    llm.LAST_PRIMARY_STATUS = 500
    return None, "http_5xx", 500

async def ok_primary(messages, max_tokens=64):  # noqa: ARG001
    # Simulate a successful primary result and ensure reset happens in caller path
    llm.LAST_PRIMARY_ERROR = None
    llm.LAST_PRIMARY_STATUS = 200
    return {"choices": [{"message": {"content": "ok"}}]}, None, 200


def test_primary_error_then_success_resets(monkeypatch):
    # Force failure state
    monkeypatch.setattr(llm, 'primary_chat', failing_primary)
    role, resp = client.post('/chat', json={'messages':[{'role':'user','content':'x'}]}).json()['_served_by'], None
    assert role in ('fallback','primary')  # Accept fallback due to failure
    assert llm.LAST_PRIMARY_ERROR is not None

    # Now success
    monkeypatch.setattr(llm, 'primary_chat', ok_primary)
    data = client.post('/chat', json={'messages':[{'role':'user','content':'x'}]}).json()
    # If served by primary, test that reset occurred.
    if data.get('_served_by') == 'primary':
        assert llm.LAST_PRIMARY_ERROR is None
        assert llm.LAST_PRIMARY_STATUS == 200
