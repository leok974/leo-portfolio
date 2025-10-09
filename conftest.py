import os, sys, types
import pytest

# Auto-mock heavy ML dependencies when running in lightweight mode
if os.getenv("LIGHTWEIGHT_TEST_DEPS") == "1":
    heavy_modules = [
        "torch",
        "transformers",
        "sentence_transformers",
        "sklearn",
        "faiss",
        "faiss_cpu",
        "onnxruntime",
        "accelerate",
    ]
    for name in heavy_modules:
        if name not in sys.modules:
            sys.modules[name] = types.SimpleNamespace(__version__="mocked")


@pytest.fixture(autouse=True)
def _fresh_settings_env(monkeypatch):
    """
    Automatically clear Settings cache after env changes in tests.
    Call monkeypatch.setenv(...) first, then rely on this to reset.
    """
    from assistant_api.settings import reset_settings_cache
    # Before each test run, start clean
    reset_settings_cache()
    yield
    # After each test, clear again in case other tests rely on different env
    reset_settings_cache()
