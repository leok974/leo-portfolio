"""Lightweight HTTP utility for internal service calls."""
from __future__ import annotations
import json
import urllib.request
from typing import Any, Optional


def http_get_json(url: str, timeout: float = 5.0, headers: Optional[dict] = None) -> Any:
    """
    Simple JSON GET request using urllib.

    Args:
        url: Target URL
        timeout: Request timeout in seconds
        headers: Optional request headers

    Returns:
        Parsed JSON response

    Raises:
        urllib.error.URLError: On network errors
        json.JSONDecodeError: On invalid JSON response
    """
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))
