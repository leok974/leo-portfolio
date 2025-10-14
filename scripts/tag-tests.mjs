#!/usr/bin/env node
/**
 * Auto-tag test files with @siteagent or @portfolio based on content heuristics
 * Usage: node scripts/tag-tests.mjs [--tag siteagent|portfolio] [--files path/to/list.txt]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');

// Parse args
const args = process.argv.slice(2);
const defaultTag = 'siteagent';
const tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : defaultTag;
const filesPath = args.includes('--files') ? args[args.indexOf('--files') + 1] : '.ci/spec-files-to-tag.txt';

const filesListPath = path.resolve(repo, filesPath);

if (!fs.existsSync(filesListPath)) {
  console.error(`Files list not found: ${filesListPath}`);
  console.error('Create it with one spec file path per line, e.g.:');
  console.error('  tests/e2e/admin.panel.spec.ts');
  console.error('  tests/e2e/home-filter.spec.ts');
  process.exit(1);
}

const specFiles = fs.readFileSync(filesListPath, 'utf8')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'))
  .map(line => path.resolve(repo, line));

console.log(`Tagging ${specFiles.length} spec files with @${tag}...`);

// Heuristics for portfolio detection
const portfolioIndicators = [
  /project-card/i,
  /#assistantChip/,
  /data-testid=['"]project-/,
  /portfolio/i,
  /calendly/i,
  /consent-banner/i,
  /privacy-page/i,
  /home.*filter/i,
  /typography/i,
  /resume.*endpoints/i,
];

const siteagentIndicators = [
  /dev-overlay/i,
  /admin.*panel/i,
  /agent.*tools/i,
  /\/agent\//,
  /@dev-only/,
  /@backend/,
  /ab-analytics.*panel/i,
  /weights.*editor/i,
  /assistant.*ui/i,
  /chat.*dock/i,
  /sources.*popover/i,
];

let changed = 0;
let skipped = 0;

for (const specPath of specFiles) {
  if (!fs.existsSync(specPath)) {
    console.warn(`⚠️  File not found: ${specPath}`);
    continue;
  }

  let src = fs.readFileSync(specPath, 'utf8');
  const orig = src;

  // Detect if this should be @portfolio based on content
  const isPortfolio = portfolioIndicators.some(rx => rx.test(src));
  const isSiteagent = siteagentIndicators.some(rx => rx.test(src));
  
  let targetTag = tag;
  if (isPortfolio && !isSiteagent) {
    targetTag = 'portfolio';
  } else if (isSiteagent) {
    targetTag = 'siteagent';
  }

  // Tag test() and test.describe() calls
  // Match: test("...", async
  //        test('...', async
  //        test.describe("...", () =>
  src = src.replace(
    /(test(?:\.describe)?)\s*\(\s*(['"])([^'"]*)\2/g,
    (match, testFn, quote, title) => {
      // Skip if already tagged
      if (/@siteagent|@portfolio|@smoke|@wip/.test(title)) {
        return match;
      }
      // Add tag
      return `${testFn}(${quote}@${targetTag} ${title}${quote}`;
    }
  );

  if (src !== orig) {
    fs.writeFileSync(specPath, src, 'utf8');
    changed++;
    console.log(`✓ Tagged with @${targetTag}: ${path.relative(repo, specPath)}`);
  } else {
    skipped++;
    console.log(`  Skipped (already tagged): ${path.relative(repo, specPath)}`);
  }
}

console.log(`\nDone! Changed: ${changed}, Skipped: ${skipped}`);
