import re
from typing import Dict, Any, List, Tuple

Command = Dict[str, Any]


def parse_command(cmd: str) -> Tuple[List[str], Dict[str, Any]]:
    """
    Very small rule-based interpreter that turns a sentence into a plan+params.
    Supported:
      - rename <repo owner/name> to <New Name>
      - rename <Old Title> to <New Title>
      - set brand to <Brand String>
      - set logo for repo <owner/name> to <path>
      - set logo for <Title> to <path>
      - (re)generate og
    """
    c = (cmd or "").strip()
    plan: List[str] = []
    params: Dict[str, Any] = {}
    if not c:
        return plan, params

    # rename repo
    m = re.search(r"rename\s+([\w.-]+/[\w.-]+)\s+to\s+(.+)$", c, re.I)
    if m:
        plan = ["overrides.update", "og.generate", "status.write"]
        params = {"rename": {"repo": m.group(1), "to": m.group(2).strip()}}
        return plan, params
    # rename title
    m = re.search(r"rename\s+(.+?)\s+to\s+(.+)$", c, re.I)
    if m:
        plan = ["overrides.update", "og.generate", "status.write"]
        params = {"rename": {"from": m.group(1).strip(), "to": m.group(2).strip()}}
        return plan, params
    # set brand
    m = re.search(r"set\s+brand\s+to\s+(.+)$", c, re.I)
    if m:
        plan = ["overrides.update", "status.write"]
        params = {"brand": m.group(1).strip()}
        return plan, params
    # set logo for repo
    m = re.search(r"set\s+logo\s+for\s+repo\s+([\w.-]+/[\w.-]+)\s+to\s+(.+)$", c, re.I)
    if m:
        plan = ["overrides.update", "og.generate", "status.write"]
        params = {"logo": {"repo": m.group(1), "path": m.group(2).strip()}}
        return plan, params
    # set logo for title
    m = re.search(r"set\s+logo\s+for\s+(.+?)\s+to\s+(.+)$", c, re.I)
    if m:
        plan = ["overrides.update", "og.generate", "status.write"]
        params = {"logo": {"title": m.group(1).strip(), "path": m.group(2).strip()}}
        return plan, params
    # regenerate og
    if re.search(r"\b(re)?generate\b.*\bog\b", c, re.I):
        plan = ["og.generate", "status.write"]
        return plan, params

    # default: no-op
    return plan, params
