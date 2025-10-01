import os, sys, types

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
