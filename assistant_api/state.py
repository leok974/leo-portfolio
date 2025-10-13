# Shared mutable state objects to avoid circular imports
# LAST_SERVED_BY tracks which provider (primary|fallback|none) last served a response
LAST_SERVED_BY: dict[str, str | float] = {"provider": "none", "ts": 0.0}

# Live SSE connection count (rough, in-process only)
SSE_CONNECTIONS: int = 0


def sse_inc():
    global SSE_CONNECTIONS
    SSE_CONNECTIONS += 1


def sse_dec():
    global SSE_CONNECTIONS
    if SSE_CONNECTIONS > 0:
        SSE_CONNECTIONS -= 1
