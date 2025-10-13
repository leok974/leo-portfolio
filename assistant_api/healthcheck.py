import json
import os
import sys
import urllib.request

URL = os.environ.get("HEALTH_URL", "http://127.0.0.1:8000/ready")

def main():
    try:
        with urllib.request.urlopen(URL, timeout=5) as r:
            raw = r.read().decode() or "{}"
            try:
                data = json.loads(raw)
            except Exception:
                data = {}
        if isinstance(data, dict) and data.get("ok") is True:
            sys.exit(0)
        # Accept older style readiness where status code 200 but no ok field
        sys.exit(0 if r.status == 200 else 1)
    except Exception:
        sys.exit(1)

if __name__ == "__main__":
    main()
