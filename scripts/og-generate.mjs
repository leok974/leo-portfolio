#!/usr/bin/env node
/**
 * OG Image Generator
 * Generates 1200×630 social card images using Playwright.
 * Zero external dependencies (beyond Playwright).
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'og');

// Minimal HTML template with gradient background
const template = ({ title, subtitle }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1200, height=630">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px;
      height: 630px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: white;
      padding: 80px;
      text-align: center;
    }
    h1 {
      font-size: 72px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 20px;
      text-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    p {
      font-size: 36px;
      font-weight: 400;
      line-height: 1.4;
      opacity: 0.95;
      text-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${subtitle}</p>
</body>
</html>
`;

// Pages to generate OG images for
const pages = [
  { slug: 'home', title: 'Leo Klemet', subtitle: 'SiteAgent — Self-Updating Portfolio Platform' },
  { slug: 'projects', title: 'Projects', subtitle: 'AI-powered tools and automation systems' },
  { slug: 'about', title: 'About', subtitle: 'Developer & automation specialist' },
  { slug: 'contact', title: 'Contact', subtitle: 'Get in touch for collaboration' },
  // Add project pages as needed
  { slug: 'ledgermind', title: 'LedgerMind', subtitle: 'AI-powered financial document processing' },
  { slug: 'siteagent', title: 'SiteAgent', subtitle: 'Automated portfolio management system' },
];

async function generateImages() {
  console.log(`🎨 Generating OG images...`);

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 }
  });

  for (const pageData of pages) {
    const html = template(pageData);
    await page.setContent(html, { waitUntil: 'networkidle' });

    const outputPath = path.join(OUTPUT_DIR, `${pageData.slug}.png`);
    await page.screenshot({
      path: outputPath,
      type: 'png'
    });

    console.log(`✅ Generated: ${pageData.slug}.png`);
  }

  await browser.close();
  console.log(`\n🎉 Generated ${pages.length} OG images in ${OUTPUT_DIR}`);
}

generateImages().catch(err => {
  console.error('❌ Error generating OG images:', err);
  process.exit(1);
});
