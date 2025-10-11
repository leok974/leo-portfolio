"""Tests for LLM router with primary→fallback logic."""
from unittest.mock import Mock, patch
import pytest


def test_llm_router_imports():
    """Test that LLM router can be imported."""
    from assistant_api.llm.router import chat_complete, _cfg, _is_retryable
    
    assert callable(chat_complete)
    assert callable(_cfg)
    assert callable(_is_retryable)


def test_llm_config_loading(monkeypatch):
    """Test configuration loading from environment."""
    from assistant_api.llm.router import _cfg
    
    monkeypatch.setenv("TEST_OPENAI_BASE_URL", "http://localhost:11434/v1")
    monkeypatch.setenv("TEST_OPENAI_API_KEY", "test-key-123")
    monkeypatch.setenv("TEST_OPENAI_MODEL", "test-model")
    monkeypatch.setenv("TEST_OPENAI_TIMEOUT_S", "25")
    
    cfg = _cfg("TEST")
    
    assert cfg["base_url"] == "http://localhost:11434/v1"
    assert cfg["api_key"] == "test-key-123"
    assert cfg["model"] == "test-model"
    assert cfg["timeout_s"] == 25.0


def test_llm_retryable_errors():
    """Test retryable error detection."""
    from assistant_api.llm.router import _is_retryable
    
    # Retryable errors
    assert _is_retryable(TimeoutError("timed out"))
    assert _is_retryable(ConnectionError("connection refused"))
    assert _is_retryable(Exception("request timeout"))
    assert _is_retryable(Exception("bad gateway"))
    assert _is_retryable(Exception("503 service unavailable"))
    
    # Non-retryable errors
    assert not _is_retryable(ValueError("invalid value"))
    assert not _is_retryable(Exception("400 bad request"))


@patch("assistant_api.llm.router.openai.OpenAI")
def test_llm_chat_complete_primary_success(mock_openai_class, monkeypatch):
    """Test successful chat completion with primary backend."""
    # Setup environment
    monkeypatch.setenv("PRIMARY_OPENAI_BASE_URL", "http://localhost:11434/v1")
    monkeypatch.setenv("PRIMARY_OPENAI_MODEL", "test-model")
    monkeypatch.setenv("PRIMARY_OPENAI_API_KEY", "dummy")
    
    # Mock OpenAI response
    mock_client = Mock()
    mock_response = Mock()
    mock_response.choices = [Mock(message=Mock(content="Test response"))]
    mock_client.chat.completions.create.return_value = mock_response
    mock_openai_class.return_value = mock_client
    
    # Reload module to pick up new env vars
    import importlib
    from assistant_api.llm import router
    importlib.reload(router)
    
    # Test
    model_used, text = router.chat_complete(
        [{"role": "user", "content": "test"}], temperature=0.2
    )
    
    assert model_used == "test-model"
    assert text == "Test response"
    assert mock_client.chat.completions.create.called


@patch("assistant_api.llm.router.openai.OpenAI")
def test_llm_chat_complete_fallback(mock_openai_class, monkeypatch):
    """Test fallback to secondary backend on primary failure."""
    # Setup environment
    monkeypatch.setenv("PRIMARY_OPENAI_BASE_URL", "http://localhost:9999")
    monkeypatch.setenv("PRIMARY_OPENAI_MODEL", "primary-model")
    monkeypatch.setenv("FALLBACK_OPENAI_BASE_URL", "https://api.openai.com/v1")
    monkeypatch.setenv("FALLBACK_OPENAI_MODEL", "fallback-model")
    monkeypatch.setenv("FALLBACK_OPENAI_API_KEY", "sk-test-123")
    
    # Mock primary failure and fallback success
    def create_client_mock(base_url, api_key):
        mock_client = Mock()
        if "9999" in (base_url or ""):
            # Primary fails with timeout
            mock_client.chat.completions.create.side_effect = TimeoutError(
                "connection timeout"
            )
        else:
            # Fallback succeeds
            mock_response = Mock()
            mock_response.choices = [Mock(message=Mock(content="Fallback response"))]
            mock_client.chat.completions.create.return_value = mock_response
        return mock_client
    
    mock_openai_class.side_effect = create_client_mock
    
    # Reload module to pick up new env vars
    import importlib
    from assistant_api.llm import router
    importlib.reload(router)
    
    # Test
    model_used, text = router.chat_complete(
        [{"role": "user", "content": "test"}], temperature=0.2
    )
    
    assert model_used == "fallback-model"
    assert text == "Fallback response"


def test_llm_no_backends_configured(monkeypatch):
    """Test error when no backends are configured."""
    # Clear all LLM env vars
    for prefix in ["PRIMARY", "FALLBACK"]:
        for suffix in ["BASE_URL", "MODEL", "API_KEY"]:
            monkeypatch.delenv(f"{prefix}_OPENAI_{suffix}", raising=False)
    
    # Reload module to pick up cleared env vars
    import importlib
    from assistant_api.llm import router
    importlib.reload(router)
    
    # Test
    with pytest.raises(RuntimeError, match="No usable LLM backends"):
        router.chat_complete([{"role": "user", "content": "test"}])


def test_llm_title_body_generation():
    """Test LLM title/body generation function."""
    from assistant_api.routers.agent_act import _llm_title_body
    
    diff_summary = "A  file1.txt\nM  file2.txt"
    insights = "Test insights"
    
    # Should fall back to default if LLM not configured
    title, body = _llm_title_body(diff_summary, insights)
    
    assert title
    assert body
    assert len(title) <= 72  # Title length limit


def test_llm_title_body_fallback_on_error(monkeypatch):
    """Test that LLM title/body falls back to default on errors."""
    from assistant_api.routers.agent_act import _llm_title_body
    
    # Force LLM error by clearing all backends
    for prefix in ["PRIMARY", "FALLBACK"]:
        for suffix in ["BASE_URL", "MODEL", "API_KEY"]:
            monkeypatch.delenv(f"{prefix}_OPENAI_{suffix}", raising=False)
    
    diff_summary = "A  file1.txt\nM  file2.txt"
    
    # Should fall back to default gracefully
    title, body = _llm_title_body(diff_summary, "")
    
    assert "chore(siteagent): apply" in title
    assert "artifact" in title
    assert "SiteAgent" in body
