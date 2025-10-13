import re
from typing import Any, Dict, List, Tuple

Command = dict[str, Any]


def parse_command(cmd: str) -> tuple[list[str], dict[str, Any]]:
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
    plan: list[str] = []
    params: dict[str, Any] = {}
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
    # (fetch|set) logo for repo
    m = re.search(
        r"(?:fetch|set)\s+logo\s+for\s+repo\s+([\w.-]+/[\w.-]+)\s+(?:from|to)\s+(.+)$",
        c,
        re.I,
    )
    if m:
        target = m.group(2).strip()
        if re.match(r"^https?://", target, re.I):
            plan = ["logo.fetch", "og.generate", "status.write"]
            params = {"url": target, "repo": m.group(1)}
        else:
            plan = ["overrides.update", "og.generate", "status.write"]
            params = {"logo": {"repo": m.group(1), "path": target}}
        return plan, params
    # (fetch|set) logo for title
    m = re.search(r"(?:fetch|set)\s+logo\s+for\s+(.+?)\s+(?:from|to)\s+(.+)$", c, re.I)
    if m:
        target = m.group(2).strip()
        if re.match(r"^https?://", target, re.I):
            plan = ["logo.fetch", "og.generate", "status.write"]
            params = {"url": target, "title": m.group(1).strip()}
        else:
            plan = ["overrides.update", "og.generate", "status.write"]
            params = {"logo": {"title": m.group(1).strip(), "path": target}}
        return plan, params
    # remove logo for repo
    m = re.search(r"remove\s+logo\s+for\s+repo\s+([\w.-]+/[\w.-]+)\b", c, re.I)
    if m:
        plan = ["overrides.update", "og.generate", "status.write"]
        params = {"logo": {"repo": m.group(1), "remove": True}}
        return plan, params
    # remove logo for title
    m = re.search(r"remove\s+logo\s+for\s+(.+)$", c, re.I)
    if m:
        plan = ["overrides.update", "og.generate", "status.write"]
        params = {"logo": {"title": m.group(1).strip(), "remove": True}}
        return plan, params
    # regenerate og
    if re.search(r"\b(re)?generate\b.*\bog\b", c, re.I):
        plan = ["og.generate", "status.write"]
        return plan, params
    # scan media
    if re.search(r"\bscan\b.*\bmedia\b", c, re.I):
        plan = ["media.scan", "status.write"]
        return plan, params
    # optimize images/pictures/media
    m = re.search(r"\b(optimi[sz]e)\b.*\b(images?|pictures?|media)\b", c, re.I)
    if m:
        plan = ["media.scan", "media.optimize", "status.write"]
        return plan, params
    # suggest link fixes
    if re.search(r"\b(suggest|recommend)\b.*\blink\b.*\bfix(es)?\b", c, re.I):
        plan = ["links.suggest", "status.write"]
        return plan, params
    # optimize layout
    if re.search(r"\b(optimi[sz]e)\b.*\blayout\b", c, re.I):
        plan = ["layout.optimize", "status.write"]
        # Extract roles if specified (e.g., "optimize layout for ai and swe")
        roles_match = re.search(r"for\s+([\w\s,]+)$", c, re.I)
        if roles_match:
            roles_text = roles_match.group(1)
            roles = [
                r.strip().lower()
                for r in re.split(r"[\s,]+and[\s,]+|[\s,]+", roles_text)
                if r.strip()
            ]
            params = {"roles": roles}
        return plan, params

    # default: no-op
    return plan, params
