#!/usr/bin/env python3
"""Direct test of analytics parsers without HTTP layer."""
import sys
sys.path.insert(0, ".")

from assistant_api.ctr_analytics.parsers import (
    from_internal_json,
    from_gsc_api,
    from_gsc_csv,
    from_ga4_json,
    detect_and_parse
)

print("=" * 60)
print("Testing Analytics Parsers (Phase 50.6.2)")
print("=" * 60)

# Test 1: Internal JSON
print("\n=== Test 1: Internal JSON ===")
internal_json = {
    "source": "search_console",
    "rows": [
        {"url": "/", "impressions": 2200, "clicks": 12},
        {"url": "/projects/siteagent", "impressions": 1850, "clicks": 11}
    ]
}
source, rows = from_internal_json(internal_json)
print(f"✓ Source: {source}")
print(f"✓ Rows: {len(rows)}")
assert len(rows) == 2
assert rows[0]["url"] == "/"
assert rows[0]["impressions"] == 2200
print("✓ Internal JSON parser works!")

# Test 2: GSC API JSON
print("\n=== Test 2: GSC API JSON ===")
gsc_api_json = {
    "rows": [
        {"keys": ["/projects/datapipe-ai"], "clicks": 6, "impressions": 1400},
        {"keys": ["https://example.com/projects/derma-ai"], "clicks": 10, "impressions": 1200}
    ]
}
source, rows = from_gsc_api(gsc_api_json)
print(f"✓ Source: {source}")
print(f"✓ Rows: {len(rows)}")
assert len(rows) == 2
assert rows[0]["url"] == "/projects/datapipe-ai"
assert rows[1]["url"] == "/projects/derma-ai"  # Normalized from absolute URL
print("✓ GSC API JSON parser works!")
print("✓ URL normalization works (absolute → relative)!")

# Test 3: CSV
print("\n=== Test 3: GSC CSV Export ===")
csv_data = """Page,Clicks,Impressions,CTR,Position
/,12,2200,0.54%,1.2
/projects/siteagent,11,1850,0.59%,1.5
/projects/datapipe-ai,6,1400,0.43%,2.1
"""
source, rows = from_gsc_csv(csv_data)
print(f"✓ Source: {source}")
print(f"✓ Rows: {len(rows)}")
assert len(rows) == 3
assert rows[0]["url"] == "/"
assert rows[0]["clicks"] == 12
assert rows[0]["impressions"] == 2200
print("✓ CSV parser works!")

# Test 4: CSV with comma-separated numbers
print("\n=== Test 4: CSV with Comma Separators ===")
csv_with_commas = """Page,Clicks,Impressions,CTR,Position
/,12,"2,200",0.54%,1.2
/blog,"1,234","56,789",2.17%,3.4
"""
source, rows = from_gsc_csv(csv_with_commas)
print(f"✓ Source: {source}")
print(f"✓ Rows: {len(rows)}")
assert len(rows) == 2
assert rows[0]["impressions"] == 2200  # "2,200" → 2200
assert rows[1]["clicks"] == 1234  # "1,234" → 1234
assert rows[1]["impressions"] == 56789  # "56,789" → 56789
print("✓ Comma separator parsing works!")

# Test 5: GA4 JSON
print("\n=== Test 5: GA4 JSON ===")
ga4_json = {
    "rows": [
        {
            "dimensionValues": [{"value": "/projects/clarity"}],
            "metricValues": [{"value": "892"}, {"value": "8"}]
        },
        {
            "dimensionValues": [{"value": "/about"}],
            "metricValues": [{"value": "1500"}, {"value": "15"}]
        }
    ]
}
source, rows = from_ga4_json(ga4_json)
print(f"✓ Source: {source}")
print(f"✓ Rows: {len(rows)}")
assert len(rows) == 2
assert source == "ga4"
assert rows[0]["url"] == "/projects/clarity"
assert rows[0]["impressions"] == 892
assert rows[0]["clicks"] == 8
print("✓ GA4 JSON parser works!")

# Test 6: Auto-detection
print("\n=== Test 6: Auto-Detection ===")
# Test with internal JSON
source, rows = detect_and_parse(internal_json, "application/json", None)
print(f"✓ Detected internal JSON: {len(rows)} rows")
assert len(rows) == 2

# Test with GSC API JSON
source, rows = detect_and_parse(gsc_api_json, "application/json", None)
print(f"✓ Detected GSC API JSON: {len(rows)} rows")
assert len(rows) == 2

# Test with CSV
source, rows = detect_and_parse(None, "text/csv", csv_data)
print(f"✓ Detected CSV: {len(rows)} rows")
assert len(rows) == 3

# Test with GA4 JSON
source, rows = detect_and_parse(ga4_json, "application/json", None)
print(f"✓ Detected GA4 JSON: {len(rows)} rows, source={source}")
assert len(rows) == 2
assert source == "ga4"

print("✓ Auto-detection works!")

# Test 7: URL Normalization
print("\n=== Test 7: URL Normalization ===")
test_urls = {
    "source": "manual",
    "rows": [
        {"url": "https://example.com/projects/test", "impressions": 100, "clicks": 5},
        {"url": "/projects/test2", "impressions": 200, "clicks": 10},
        {"url": "projects/test3", "impressions": 150, "clicks": 7}
    ]
}
source, rows = from_internal_json(test_urls)
print(f"✓ Rows: {len(rows)}")
assert rows[0]["url"] == "/projects/test"  # https://... → /projects/test
assert rows[1]["url"] == "/projects/test2"  # Already relative
assert rows[2]["url"] == "/projects/test3"  # No leading slash → added
print("✓ All URLs normalized to relative paths!")

print("\n" + "=" * 60)
print("✅ ALL PARSER TESTS PASSED!")
print("=" * 60)
print("\nPhase 50.6.2 Parsers Validated:")
print("  ✓ Internal JSON format")
print("  ✓ GSC API JSON format")
print("  ✓ GSC CSV export format")
print("  ✓ GA4 JSON format")
print("  ✓ CSV comma separator handling")
print("  ✓ URL normalization (absolute → relative)")
print("  ✓ Auto-detection of all formats")
