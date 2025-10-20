#!/usr/bin/env node
/**
 * OG Image Generator
 * Generates 1200×630 social card images using Playwright.
 * Zero external dependencies (beyond Playwright).
 *
 * Generates:
 *   - public/og/og.png (homepage fallback)
 *   - public/og/{slug}.png (per-project images)
 *
 * Usage:
 *   node scripts/og-generate.mjs
 *   npm run og:gen
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'apps', 'portfolio-ui', 'public', 'og');

// Minimal HTML template with gradient background
const template = ({ title, subtitle, tags }) => `
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
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: white;
      padding: 80px;
      text-align: center;
      position: relative;
    }
    .logo {
      position: absolute;
      top: 50px;
      right: 80px;
      width: 140px;
      height: 140px;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 56px;
      font-weight: 700;
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
    }
    h1 {
      font-size: 72px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 30px;
      color: #E6ECF4;
      text-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 900px;
    }
    p {
      font-size: 32px;
      font-weight: 400;
      line-height: 1.4;
      color: #A7B4C6;
      opacity: 0.95;
      text-shadow: 0 2px 8px rgba(0,0,0,0.2);
      max-width: 900px;
    }
    .tags {
      margin-top: 30px;
      font-size: 28px;
      font-weight: 600;
      color: #60a5fa;
    }
  </style>
</head>
<body>
  <div class="logo">LK</div>
  <h1>${title}</h1>
  <p>${subtitle}</p>
  ${tags ? `<div class="tags">${tags}</div>` : ''}
</body>
</html>
`;

// Load projects from data/projects.json
async function loadProjects() {
  const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
  const hiddenPath = path.join(__dirname, '..', 'apps', 'portfolio-ui', 'public', 'projects.hidden.json');

  if (!existsSync(projectsPath)) {
    console.warn('⚠️  data/projects.json not found. Only generating homepage OG.');
    return [];
  }

  const data = await fs.readFile(projectsPath, 'utf8');
  let projects = JSON.parse(data);

  // Filter out hidden projects
  try {
    if (existsSync(hiddenPath)) {
      const hiddenData = await fs.readFile(hiddenPath, 'utf8');
      const hidden = JSON.parse(hiddenData);
      const hiddenSet = new Set((hidden ?? []).map(s => String(s || '').trim().toLowerCase()));
      const before = projects.length;
      projects = projects.filter(p => !hiddenSet.has((p.slug || '').toLowerCase()));
      console.log(`✓ Filtered ${before - projects.length} hidden projects (${projects.length} visible)`);
    }
  } catch (e) {
    console.warn(`⚠️  Could not load hidden list: ${e.message}`);
  }

  return projects;
}

async function generateImages() {
  console.log(`🎨 Generating OG images...\n`);

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 }
  });

  // Generate homepage OG
  const homeHtml = template({
    title: 'Leo Klemet — Portfolio',
    subtitle: 'AI Engineer • Full-Stack • Agents',
    tags: null
  });
  await page.setContent(homeHtml, { waitUntil: 'networkidle' });
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'og.png'),
    type: 'png'
  });
  console.log(`✅ Generated: og.png (homepage fallback)`);

  // Load and generate project OG images
  const projects = await loadProjects();
  if (projects.length > 0) {
    console.log(`\n📦 Generating OG images for ${projects.length} projects...\n`);

    for (const project of projects) {
      const html = template({
        title: project.title,
        subtitle: project.one_liner,
        tags: project.tags?.slice(0, 3).join(' • ') || null
      });
      await page.setContent(html, { waitUntil: 'networkidle' });

      const outputPath = path.join(OUTPUT_DIR, `${project.slug}.png`);
      await page.screenshot({
        path: outputPath,
        type: 'png'
      });

      console.log(`✅ Generated: ${project.slug}.png`);
    }
  }

  await browser.close();
  console.log(`\n🎉 Generated ${projects.length + 1} OG images in ${OUTPUT_DIR}`);
}

generateImages().catch(err => {
  console.error('❌ Error generating OG images:', err);
  process.exit(1);
});
