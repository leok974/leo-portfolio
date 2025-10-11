"""Agent specification and registry loading."""
from pydantic import BaseModel
from typing import List, Dict, Optional
import yaml
import pathlib

REGISTRY_PATH = pathlib.Path(__file__).resolve().parents[2] / "agents.yml"


class AgentSpec(BaseModel):
    """Specification for an autonomous agent."""
    name: str
    goals: List[str]
    tools: List[str]
    allow_auto: bool = False


_registry_cache: Optional[Dict[str, AgentSpec]] = None


def load_registry() -> Dict[str, AgentSpec]:
    """Load agent registry from agents.yml (cached after first load)."""
    global _registry_cache
    if _registry_cache is not None:
        return _registry_cache

    with REGISTRY_PATH.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    _registry_cache = {name: AgentSpec(name=name, **cfg) for name, cfg in raw.items()}
    return _registry_cache
