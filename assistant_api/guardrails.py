from __future__ import annotations

import os
import re

# Lightweight patterns; easy to extend later
INJECTION_PATTERNS: list[str] = [
    # attempts to ignore/override instructions or system prompts
    r"\b(ignore|bypass|override)\b.*\b(instruction(s)?|system\s+prompt|guardrails?)\b",
    # attempts to reveal hidden/system/secret content
    r"\b(show|reveal|print)\b.*\b(system|hidden|confidential|secret(s)?)\b",
    # attempts to extract/dump secrets or keys
    r"\b(extract|leak|dump)\b.*\b(secret(s)?|key(s)?)\b",
    # common jailbreak tokens
    r"\bDAN\b|\bjailbreak\b|BEGIN_(SYSTEM|PROMPT)",
]

SECRET_PATTERNS: list[str] = [
    r"AKIA[0-9A-Z]{16}",  # AWS Access Key
    r"-----BEGIN (?:RSA|EC|DSA) PRIVATE KEY-----",
    r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}",  # JWT
    r"sk-[A-Za-z0-9]{32,}",  # generic API key-ish
]

def detect_injection(text: str) -> tuple[bool, list[str]]:
    hits: list[str] = []
    for pat in INJECTION_PATTERNS:
        if re.search(pat, text, flags=re.I | re.S):
            hits.append(pat)
    return (len(hits) > 0, hits)

def detect_secrets(text: str) -> tuple[bool, list[str]]:
    hits: list[str] = []
    for pat in SECRET_PATTERNS:
        if re.search(pat, text, flags=re.I | re.S):
            hits.append(pat)
    return (len(hits) > 0, hits)

def sanitize_snippet(s: str) -> str:
    # Redact matched secrets with a placeholder token.
    for pat in SECRET_PATTERNS:
        s = re.sub(pat, "[REDACTED]", s, flags=re.I | re.S)
    return s

def should_enforce() -> bool:
    # GUARDRAILS_MODE: "enforce" (default) or "log"
    mode = os.getenv("GUARDRAILS_MODE", "enforce").lower()
    # ALLOW_UNSAFE=1 disables enforcement for dev
    return (mode == "enforce") and (os.getenv("ALLOW_UNSAFE", "0") != "1")
