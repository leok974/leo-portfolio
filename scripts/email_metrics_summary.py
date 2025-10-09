#!/usr/bin/env python3
"""
Email weekly metrics summary via SendGrid.
Requires SENDGRID_API_KEY, EMAIL_FROM, EMAIL_TO in settings.
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import requests
except ImportError:
    print("Error: requests library not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

from assistant_api.settings import get_settings
from assistant_api.services.analytics_store import AnalyticsStore
from assistant_api.routers.agent_metrics import metrics_summary


def build_html(rows: list[dict]) -> str:
    """Build HTML email body with metrics table."""
    table_rows = "".join(
        f"""
        <tr>
            <td style="padding:8px; border:1px solid #ddd;">{r['section']}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:right;">{r['views']}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:right;">{r['clicks']}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:right;">{r['ctr']*100:.1f}%</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:right;">{round(r['avg_dwell_ms'])}ms</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:right;">{r['weight']:.3f}</td>
        </tr>
        """
        for r in rows
    )

    return f"""
    <html>
    <body style="font-family:sans-serif; margin:20px;">
        <h2 style="color:#333;">Weekly Behavior Metrics Summary</h2>
        <p style="color:#666;">14-day rolling window data.</p>
        <table style="border-collapse:collapse; width:100%; max-width:800px;">
            <thead>
                <tr style="background:#f5f5f5;">
                    <th style="padding:8px; border:1px solid #ddd; text-align:left;">Section</th>
                    <th style="padding:8px; border:1px solid #ddd; text-align:right;">Views</th>
                    <th style="padding:8px; border:1px solid #ddd; text-align:right;">Clicks</th>
                    <th style="padding:8px; border:1px solid #ddd; text-align:right;">CTR</th>
                    <th style="padding:8px; border:1px solid #ddd; text-align:right;">Avg Dwell</th>
                    <th style="padding:8px; border:1px solid #ddd; text-align:right;">Weight</th>
                </tr>
            </thead>
            <tbody>
                {table_rows}
            </tbody>
        </table>
        <p style="color:#999; font-size:12px; margin-top:20px;">
            This is an automated email from your behavior analytics system.
        </p>
    </body>
    </html>
    """


async def main() -> int:
    """Fetch metrics and send email via SendGrid."""
    settings = get_settings()

    # Check required settings
    if not settings.get("SENDGRID_API_KEY"):
        print("Error: SENDGRID_API_KEY not configured", file=sys.stderr)
        return 1
    if not settings.get("EMAIL_FROM"):
        print("Error: EMAIL_FROM not configured", file=sys.stderr)
        return 1
    if not settings.get("EMAIL_TO"):
        print("Error: EMAIL_TO not configured", file=sys.stderr)
        return 1

    # Fetch metrics summary
    store = AnalyticsStore(settings["ANALYTICS_DIR"])
    summary = await metrics_summary(store=store)

    if not summary["rows"]:
        print("No metrics data available, skipping email", file=sys.stderr)
        return 0

    # Build email
    html_body = build_html(summary["rows"])
    payload = {
        "personalizations": [{"to": [{"email": settings["EMAIL_TO"]}]}],
        "from": {"email": settings["EMAIL_FROM"]},
        "subject": f"Weekly Metrics Summary · {summary['total_events']} events",
        "content": [{"type": "text/html", "value": html_body}],
    }

    # Send via SendGrid API
    headers = {
        "Authorization": f"Bearer {settings['SENDGRID_API_KEY']}",
        "Content-Type": "application/json",
    }
    response = requests.post(
        "https://api.sendgrid.com/v3/mail/send", json=payload, headers=headers, timeout=10
    )

    if response.ok:
        print(f"✅ Email sent successfully to {settings['EMAIL_TO']}")
        return 0
    else:
        print(f"❌ SendGrid API error: {response.status_code} {response.text}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
