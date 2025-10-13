"""
Pytest configuration and fixtures for assistant_api tests.

Sets up test environment with:
- In-memory database
- Test mode configuration
- Mocked external dependencies
- FastAPI TestClient
"""

import os

import pytest
from fastapi.testclient import TestClient

# Set test environment before importing app
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("RAG_DB_PATH", ":memory:")
os.environ.setdefault("PRIMARY_MODEL", "qwen2.5:7b-instruct-q4_K_M")
os.environ.setdefault("FALLBACK_MODEL", "gpt-4o-mini")
os.environ.setdefault(
    "ENABLE_RAG", "false"
)  # Disable RAG in tests unless explicitly enabled


@pytest.fixture(scope="session")
def client():
    """
    FastAPI TestClient for making requests to the API.
    Uses in-memory database and test configuration.
    """
    from assistant_api.main import app

    return TestClient(app)


@pytest.fixture(autouse=True)
def mock_llm_generate(monkeypatch):
    """
    Mock LLM generate calls to avoid real model inference.
    Automatically applied to all tests.
    """

    def fake_generate(*args, **kwargs):
        return {
            "text": "Test response from mocked LLM",
            "tokens_in": 10,
            "tokens_out": 8,
            "model": "test-model",
        }

    try:
        import assistant_api.llm

        monkeypatch.setattr("assistant_api.llm.generate", fake_generate)
    except (ImportError, AttributeError):
        # llm module may not have generate function, skip
        pass


@pytest.fixture(autouse=True)
def mock_ollama_client(monkeypatch):
    """
    Mock Ollama client to avoid real API calls.
    Automatically applied to all tests.
    """

    class FakeOllamaClient:
        def generate(self, **kwargs):
            return {"response": "Test response"}

        def list(self):
            return {"models": [{"name": "test-model"}]}

        def chat(self, **kwargs):
            return {"message": {"content": "Test chat response"}}

    try:
        monkeypatch.setattr("ollama.Client", lambda *args, **kwargs: FakeOllamaClient())
    except (ImportError, AttributeError):
        pass


@pytest.fixture(autouse=True)
def mock_openai_client(monkeypatch):
    """
    Mock OpenAI client to avoid real API calls.
    Automatically applied to all tests.
    """

    class FakeOpenAIResponse:
        def __init__(self, content="Test OpenAI response"):
            self.choices = [
                type(
                    "obj",
                    (object,),
                    {"message": type("obj", (object,), {"content": content})()},
                )()
            ]

    class FakeOpenAIClient:
        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    return FakeOpenAIResponse()

    try:
        monkeypatch.setattr("openai.OpenAI", lambda *args, **kwargs: FakeOpenAIClient())
    except (ImportError, AttributeError):
        pass


@pytest.fixture
def test_db_path(tmp_path):
    """
    Provides a temporary database path for tests that need persistent storage.
    """
    return str(tmp_path / "test.db")


@pytest.fixture
def clean_env(monkeypatch):
    """
    Provides a clean environment for tests that need to manipulate env vars.
    """
    # Store original env
    original_env = dict(os.environ)

    yield monkeypatch

    # Restore original env
    os.environ.clear()
    os.environ.update(original_env)
