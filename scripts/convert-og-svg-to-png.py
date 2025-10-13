#!/usr/bin/env python3
"""
Convert og.svg to og.png for better social media support.
Uses Playwright to render SVG in a browser and capture as PNG.
"""
import sys
import asyncio
from pathlib import Path

# Paths
svg_path = Path("apps/portfolio-ui/public/og.svg")
png_path = Path("apps/portfolio-ui/public/og.png")

# Validate source exists
if not svg_path.exists():
    print(f"❌ Source SVG not found: {svg_path}")
    sys.exit(1)

# Read SVG content
svg_content = svg_path.read_text(encoding='utf-8')

# Create HTML wrapper for SVG
html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ margin: 0; padding: 0; }}
        svg {{ display: block; }}
    </style>
</head>
<body>
{svg_content}
</body>
</html>
"""

async def convert():
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("❌ Playwright not installed. Installing...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
        from playwright.async_api import async_playwright

    print(f"🔄 Converting {svg_path} to {png_path}...")

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1200, 'height': 630})

        # Load SVG via data URL
        await page.set_content(html_content)

        # Wait for render
        await page.wait_for_timeout(500)

        # Screenshot
        await page.screenshot(path=str(png_path), full_page=False)

        await browser.close()

    # Verify output
    if png_path.exists():
        size_kb = png_path.stat().st_size / 1024
        print(f"✅ Created {png_path} ({size_kb:.1f} KB)")
    else:
        print(f"❌ Failed to create {png_path}")
        sys.exit(1)

asyncio.run(convert())
