# assistant_api/utils/artifacts.py
import os
from typing import Tuple

def ensure_artifacts_dir(path: str):
    os.makedirs(path, exist_ok=True)

def write_artifact(dir_path: str, name: str, content: str) -> str:
    ensure_artifacts_dir(dir_path)
    path = os.path.join(dir_path, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path
