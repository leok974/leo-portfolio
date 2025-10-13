"""Agent specification and registry loading."""
import pathlib
from typing import Dict, List, Optional

import yaml
from pydantic import BaseModel

REGISTRY_PATH = pathlib.Path(__file__).resolve().parents[2] / "agents.yml"


class AgentSpec(BaseModel):
    """Specification for an autonomous agent."""
    name: str
    goals: list[str]
    tools: list[str]
    allow_auto: bool = False


_registry_cache: dict[str, AgentSpec] | None = None


def load_registry() -> dict[str, AgentSpec]:
    """Load agent registry from agents.yml (cached after first load)."""
    global _registry_cache
    if _registry_cache is not None:
        return _registry_cache

    with REGISTRY_PATH.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    _registry_cache = {name: AgentSpec(name=name, **cfg) for name, cfg in raw.items()}
    return _registry_cache
