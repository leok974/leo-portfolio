from __future__ import annotations

import ipaddress
from functools import lru_cache
from typing import Optional

try:
    import geoip2.database  # type: ignore
except Exception:
    geoip2 = None  # optional dependency


def anonymize_prefix(ip: str | None) -> str | None:
    """IPv4 -> /24, IPv6 -> /48. Returns CIDR string or None."""
    if not ip:
        return None
    try:
        ip_obj = ipaddress.ip_address(ip)
        if ip_obj.version == 4:
            net = ipaddress.ip_network(f"{ip_obj}/24", strict=False)
            return f"{net.network_address}/24"
        else:
            net = ipaddress.ip_network(f"{ip_obj}/48", strict=False)
            return f"{net.network_address}/48"
    except Exception:
        return None


@lru_cache(maxsize=1)
def get_geo_reader(db_path: str | None):
    """Cache the GeoIP reader so we don't reopen per request."""
    if not (db_path and geoip2):
        return None
    try:
        return geoip2.database.Reader(db_path)
    except Exception:
        return None


def lookup_country(ip: str | None, db_path: str | None) -> str | None:
    reader = get_geo_reader(db_path)
    if not (reader and ip):
        return None
    try:
        return reader.country(ip).country.iso_code
    except Exception:
        return None
