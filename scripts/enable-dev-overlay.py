"""Enable dev overlay with HMAC authentication for local testing."""
import hashlib
import hmac
import os
import requests
import json

# Read HMAC secret from environment or .env
HMAC_SECRET = os.getenv("SITEAGENT_HMAC_SECRET", "")
if not HMAC_SECRET:
    # Try to read from .env files
    for env_file in [".env", "assistant_api/.env", ".env.local"]:
        if os.path.exists(env_file):
            with open(env_file) as f:
                for line in f:
                    if line.startswith("SITEAGENT_HMAC_SECRET="):
                        HMAC_SECRET = line.split("=", 1)[1].strip()
                        break
            if HMAC_SECRET:
                break

if not HMAC_SECRET:
    print("❌ SITEAGENT_HMAC_SECRET not found in environment or .env files")
    print("\nPlease add to .env or assistant_api/.env:")
    print("SITEAGENT_HMAC_SECRET=your-secret-key-here")
    exit(1)

# Prepare request
url = "http://localhost:8001/agent/dev/enable"
body = json.dumps({"hours": 24})  # Enable for 24 hours
body_bytes = body.encode('utf-8')

# Calculate HMAC signature
signature = hmac.new(
    HMAC_SECRET.encode('utf-8'),
    body_bytes,
    hashlib.sha256
).hexdigest()

# Make request (signature must be prefixed with "sha256=")
headers = {
    "Content-Type": "application/json",
    "X-SiteAgent-Signature": f"sha256={signature}"
}

try:
    # Use session to persist cookies between requests
    session = requests.Session()
    response = session.post(url, data=body_bytes, headers=headers)

    if response.status_code == 200:
        print("✅ Dev overlay enabled successfully!")
        print(f"Response: {response.text}")

        # Verify status (using same session to send cookie)
        status_response = session.get("http://localhost:8001/agent/dev/status")
        status = status_response.json()
        print(f"\nStatus: {status}")

        if status.get("enabled"):
            print("✅ Cookie verified - dev overlay is active!")
        else:
            print("⚠️  Cookie not detected in status check")
            print("   (This may be normal - try refreshing your browser)")
    else:
        print(f"❌ Failed to enable dev overlay")
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.text}")
except Exception as e:
    print(f"❌ Error: {e}")
