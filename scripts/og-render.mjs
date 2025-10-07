#!/usr/bin/env node
// Renders OG images for projects.json using Playwright (if available).
// Usage: node scripts/og-render.mjs --input ./assets/data/projects.json --out ./assets/og --template ./public/og/template.html
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
function arg(name, def = undefined) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
}
const input = arg('input');
const outDir = arg('out', './assets/og');
const template = arg('template', './public/og/template.html');
const overridesPath = arg('overrides', './assets/data/og-overrides.json');

if (!input || !fs.existsSync(input)) {
  console.log(JSON.stringify({ error: 'missing_input', input }));
  process.exit(0);
}
if (!fs.existsSync(template)) {
  console.log(JSON.stringify({ error: 'missing_template', template }));
  process.exit(0);
}
fs.mkdirSync(outDir, { recursive: true });

const slug = (s) => (s || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

let projects = [];
try {
  const j = JSON.parse(fs.readFileSync(input, 'utf-8'));
  projects = j.projects || [];
} catch (e) {
  console.log(JSON.stringify({ error: 'bad_projects_json', message: String(e) }));
  process.exit(0);
}

// Load optional overrides: brand + title aliases
let overrides = {};
try {
  if (fs.existsSync(overridesPath)) {
    overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'));
  }
} catch {}
const brand = overrides.brand || process.env.SITEAGENT_BRAND || 'LEO KLEMET — SITEAGENT';
const titleAlias = overrides.title_alias || {};    // e.g., { "leo-portfolio": "siteAgent" }
const repoAlias  = overrides.repo_alias  || {};    // e.g., { "leok974/leo-portfolio": "siteAgent" }

// Try to import Playwright; if missing, no-op gracefully.
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log(JSON.stringify({ generated: 0, existing: 0, dir: outDir, note: 'playwright_not_installed' }));
  process.exit(0);
}

const toQuery = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v || ''))}`)
    .join('&');

let generated = 0;
let existing = 0;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1200, height: 630 } });
const page = await context.newPage();

for (const p of projects) {
  // Prefer displayName/name, allow alias by repo or name
  let name = p.displayName || p.name || p.repo || 'Project';
  if (p.repo && repoAlias[p.repo]) name = repoAlias[p.repo];
  if (p.name && titleAlias[p.name]) name = titleAlias[p.name];
  const desc = p.description || '';
  const tags = (p.topics || []).slice(0, 3).join(', ');
  const file = path.join(outDir, `${slug(name) || 'project'}.png`);
  if (fs.existsSync(file)) { existing++; continue; }
  const url = `file://${path.resolve(template)}?${toQuery({ title: name, subtitle: desc, tags, brand })}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.screenshot({ path: file });
  generated++;
}

await browser.close();
console.log(JSON.stringify({ generated, existing, dir: outDir }));
