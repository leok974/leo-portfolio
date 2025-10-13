# assistant_api/analytics/parsers.py
from __future__ import annotations

import csv
import io
from typing import Any, Dict, List, Tuple

Row = dict[str, Any]

def _norm_url(url: str) -> str:
    if not url:
        return url
    # Keep relative paths if caller already provides them; otherwise strip scheme/host.
    url = url.strip()
    # Convert absolute → path (e.g., https://site.com/projects/x → /projects/x)
    try:
        if "://" in url:
            from urllib.parse import urlparse
            p = urlparse(url)
            url = p.path or "/"
    except Exception:
        pass
    if not url.startswith("/"):
        url = "/" + url
    return url

def from_internal_json(payload: dict[str, Any]) -> tuple[str, list[Row]]:
    """
    Our internal format:
      { source: "...", rows: [{url, impressions, clicks}, ...] }
    """
    src = payload.get("source") or "search_console"
    rows = []
    for r in payload.get("rows", []):
        try:
            url = _norm_url(str(r["url"]))
            imp = int(r.get("impressions", 0))
            clk = int(r.get("clicks", 0))
        except Exception:
            continue
        rows.append({"url": url, "impressions": imp, "clicks": clk})
    return src, rows

def from_gsc_api(payload: dict[str, Any]) -> tuple[str, list[Row]]:
    """
    Google Search Console API (searchanalytics.query) style:
      rows: [{ keys:["/path"], clicks: n, impressions: n, ... }, ...]
    Or keys may contain full URL. We only read keys[0], clicks, impressions.
    """
    src = "search_console"
    out: list[Row] = []
    for r in payload.get("rows", []):
        keys = r.get("keys") or []
        if not keys:
            continue
        url = _norm_url(str(keys[0]))
        imp = int(r.get("impressions", 0))
        clk = int(r.get("clicks", 0))
        out.append({"url": url, "impressions": imp, "clicks": clk})
    return src, out

def from_gsc_csv(text: str) -> tuple[str, list[Row]]:
    """
    GSC UI CSV export (typical headers):
      "Page","Clicks","Impressions","CTR","Position"
    """
    src = "search_console"
    f = io.StringIO(text)
    reader = csv.DictReader(f)
    out: list[Row] = []
    # Normalize header variants
    def get_num(d: dict[str, str], *keys: str) -> int:
        for k in keys:
            if k in d and d[k] != "":
                try:
                    return int(float(d[k]))  # CSV may have "1,234" → this will fail; strip commas:
                except Exception:
                    try:
                        return int(float(d[k].replace(",", "")))
                    except Exception:
                        pass
        return 0

    for row in reader:
        page = row.get("Page") or row.get("page") or row.get("URL") or row.get("url")
        if not page:
            continue
        url = _norm_url(page)
        clk = get_num(row, "Clicks", "clicks")
        imp = get_num(row, "Impressions", "impressions")
        out.append({"url": url, "impressions": imp, "clicks": clk})
    return src, out

def from_ga4_json(payload: dict[str, Any]) -> tuple[str, list[Row]]:
    """
    Very loose GA4 mapping (if user exports page paths and views/click-like custom metric):
    Accepts either:
      { rows: [ { dimensionValues:[{value:"/path"}], metricValues:[{value:"123"}, {value:"7"}] }, ...] }
    or simple arrays of objects with pagePath & clicks/impressions hints.
    We approximate clicks using 'clicks' or 'events' if present; impressions ~ page_views.
    """
    src = "ga4"
    out: list[Row] = []
    rows = payload.get("rows")
    if isinstance(rows, list) and rows and "dimensionValues" in rows[0]:
        for r in rows:
            dims = r.get("dimensionValues") or []
            mets = r.get("metricValues") or []
            url = _norm_url((dims[0].get("value") if dims else "") or "/")
            # Heuristics: metric[0] ~ impressions/page_views; metric[1] ~ clicks/events
            imp = 0
            clk = 0
            if mets:
                try:
                    imp = int(float(mets[0].get("value", "0")))
                except Exception:
                    pass
                if len(mets) > 1:
                    try:
                        clk = int(float(mets[1].get("value", "0")))
                    except Exception:
                        pass
            out.append({"url": url, "impressions": imp, "clicks": clk})
        return src, out

    # Fallback simple-object mapping
    guess = payload.get("rows") if isinstance(payload.get("rows"), list) else payload
    if isinstance(guess, list):
        for r in guess:
            url = _norm_url(str(r.get("pagePath") or r.get("url") or r.get("path") or "/"))
            imp = int(r.get("impressions") or r.get("pageViews") or r.get("views") or 0)
            clk = int(r.get("clicks") or r.get("events") or 0)
            out.append({"url": url, "impressions": imp, "clicks": clk})
    return src, out

def detect_and_parse(payload: Any, content_type: str | None, raw_text: str | None) -> tuple[str, list[Row]]:
    """
    Try formats in order:
      1) Our internal {source, rows:[{url,impressions,clicks}]}
      2) GSC API JSON (rows:[{keys:[], clicks, impressions}])
      3) GA4 JSON loose mapping
      4) CSV (GSC UI export)
    """
    # CSV?
    if raw_text is not None and content_type and "csv" in content_type.lower():
        return from_gsc_csv(raw_text)

    # If JSON-like object provided, attempt each mapper.
    if isinstance(payload, dict):
        # Internal
        src, rows = from_internal_json(payload)
        if rows:
            return src, rows
        # GSC API
        src, rows = from_gsc_api(payload)
        if rows:
            return src, rows
        # GA4
        src, rows = from_ga4_json(payload)
        if rows:
            return src, rows

    # If array-of-rows passed directly: map minimal fields
    if isinstance(payload, list):
        rows: list[Row] = []
        for r in payload:
            if not isinstance(r, dict):
                continue
            url = _norm_url(str(r.get("url") or r.get("Page") or r.get("pagePath") or r.get("path") or ""))
            imp = int(r.get("impressions") or r.get("Impressions") or r.get("pageViews") or r.get("views") or 0)
            clk = int(r.get("clicks") or r.get("Clicks") or r.get("events") or 0)
            if url:
                rows.append({"url": url, "impressions": imp, "clicks": clk})
        if rows:
            return "search_console", rows

    # CSV fallback if content-type was misleading but body looks like CSV
    if raw_text and raw_text.strip() and "," in raw_text.splitlines()[0]:
        try:
            return from_gsc_csv(raw_text)
        except Exception:
            pass

    return "search_console", []
