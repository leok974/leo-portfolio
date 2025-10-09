/**
 * SEO JSON-LD Build-Time Injector
 *
 * Fetches JSON-LD from the backend and injects it into HTML files during build.
 * This is ideal for SEO as the structured data is present in the initial HTML.
 *
 * Usage:
 * 1. Start the backend: uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
 * 2. Run this script: node scripts/inject-jsonld.mjs
 * 3. Or with custom URLs: BASE_URL="https://example.com" SEO_LD_URL="https://example.com/agent/seo/ld/generate" node scripts/inject-jsonld.mjs
 *
 * The script:
 * - Reads a list of pages to process
 * - Fetches JSON-LD for each page from the backend
 * - Injects <script type="application/ld+json"> into HTML before </head>
 * - Preserves existing JSON-LD (updates idempotently)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const ENDPOINT = process.env.SEO_LD_URL || 'http://127.0.0.1:8001/agent/seo/ld/generate';

// Pages to process; extend as needed
const PAGES = [
  // Home page
  { rel: 'index.html', url: `${BASE}/`, types: ["WebPage","WebSite","BreadcrumbList","Person","Organization","Article"] },

  // Project pages
  { rel: 'projects/ledgermind.html', url: `${BASE}/projects/ledgermind`, types: ["WebPage","WebSite","BreadcrumbList","Person","Organization","CreativeWork"] },
  { rel: 'projects/datapipe-ai.html', url: `${BASE}/projects/datapipe-ai`, types: ["WebPage","WebSite","BreadcrumbList","Person","Organization","CreativeWork"] },
  { rel: 'projects/clarity.html', url: `${BASE}/projects/clarity`, types: ["WebPage","WebSite","BreadcrumbList","Person","Organization","CreativeWork"] },
  { rel: 'projects/dermaai.html', url: `${BASE}/projects/dermaai`, types: ["WebPage","WebSite","BreadcrumbList","Person","Organization","CreativeWork"] },
  { rel: 'projects/pixo-banana-suite.html', url: `${BASE}/projects/pixo-banana-suite`, types: ["WebPage","WebSite","BreadcrumbList","Person","Organization","CreativeWork"] },

  // Additional pages
  { rel: 'privacy.html', url: `${BASE}/privacy`, types: ["WebPage","WebSite","BreadcrumbList","Person","Organization"] },
  { rel: 'agent.html', url: `${BASE}/agent`, types: ["WebPage","WebSite","BreadcrumbList","Person","Organization"] },
  { rel: 'book.html', url: `${BASE}/book`, types: ["WebPage","WebSite","BreadcrumbList","Person","Organization"] },
  // Gallery if public-facing:
  // { rel: 'public/gallery.html', url: `${BASE}/gallery`, types: ["WebPage","WebSite","BreadcrumbList","Person","Organization"] },
];

/**
 * Fetch JSON-LD from the backend
 */
async function fetchJsonLd(url, types) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ url, types, dry_run: true })
  });

  if (!response.ok) {
    throw new Error(`LD generate failed for ${url}: ${response.status}`);
  }

  const json = await response.json();
  return JSON.stringify(json.jsonld);
}

/**
 * Inject JSON-LD into HTML file (idempotent)
 */
async function injectIntoFile(filePath, json) {
  let html = await fs.readFile(filePath, 'utf8');

  const tag = `<script type="application/ld+json" id="ld-main">${json}</script>`;

  // Update existing JSON-LD or inject new
  if (html.includes('id="ld-main"')) {
    // Replace existing
    html = html.replace(/<script[^>]*id="ld-main"[\s\S]*?<\/script>/, tag);
  } else {
    // Inject before </head>
    html = html.replace('</head>', `${tag}\n</head>`);
  }

  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // Write updated HTML
  await fs.writeFile(filePath, html, 'utf8');
}

/**
 * Main execution
 */
async function main() {
  const root = process.cwd(); // repo root

  console.log(`\n=== SEO JSON-LD Build-Time Injector ===`);
  console.log(`Backend: ${ENDPOINT}`);
  console.log(`Base URL: ${BASE}`);
  console.log(`Processing ${PAGES.length} page(s)...\n`);

  for (const page of PAGES) {
    try {
      const filePath = path.join(root, page.rel);
      const json = await fetchJsonLd(page.url, page.types);
      await injectIntoFile(filePath, json);
      console.log(`✓ Injected JSON-LD → ${page.rel}`);
    } catch (error) {
      console.error(`✗ Failed to process ${page.rel}:`, error.message);
      process.exit(1);
    }
  }

  console.log(`\n✓ All pages processed successfully!`);
}

main().catch((error) => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
