from collections import deque
from typing import Deque, Dict, List, Tuple

# in-proc short-term memory: user_id -> deque of (role, content)
_MAX = 12
_mem: Dict[str, Deque[Tuple[str, str]]] = {}


def remember(user_id: str, role: str, content: str) -> None:
    q = _mem.setdefault(user_id, deque(maxlen=_MAX))
    q.append((role, content))


def recall(user_id: str) -> List[Tuple[str, str]]:
    return list(_mem.get(user_id, []))


def clear(user_id: str) -> None:
    _mem.pop(user_id, None)
