from __future__ import annotations
from functools import lru_cache
import ipaddress
from typing import Optional

try:
    import geoip2.database  # type: ignore
except Exception:
    geoip2 = None  # optional dependency

def anonymize_prefix(ip: Optional[str]) -> Optional[str]:
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
def get_geo_reader(db_path: Optional[str]):
    """Cache the GeoIP reader so we don't reopen per request."""
    if not (db_path and geoip2):
        return None
    try:
        return geoip2.database.Reader(db_path)
    except Exception:
        return None

def lookup_country(ip: Optional[str], db_path: Optional[str]) -> Optional[str]:
    reader = get_geo_reader(db_path)
    if not (reader and ip):
        return None
    try:
        return reader.country(ip).country.iso_code
    except Exception:
        return None
