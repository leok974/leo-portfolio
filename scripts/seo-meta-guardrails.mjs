#!/usr/bin/env node
/**
 * Validate *.apply.json proposal lengths.
 * - Emits GitHub annotations for each violation
 * - Writes guardrails-violations.json (for the PR review step) if violations exist
 * - Exits 0 (the workflow decides whether to fail after posting a review)
 * - Supports per-path limits from .github/seo-meta-reviewers.json
 */
import fs from 'fs';

const files = process.argv.slice(2).filter(Boolean);
if (!files.length) {
  console.log('No apply.json files changed — nothing to validate.');
  process.exit(0);
}

const CFG_PATH = '.github/seo-meta-reviewers.json';
const cfg = fs.existsSync(CFG_PATH) ? JSON.parse(fs.readFileSync(CFG_PATH, 'utf-8')) : {};
const defaults = (cfg.defaults && cfg.defaults.limits) || { title_max: 60, desc_max: 155 };
const rules = (cfg.rules || []).map(r => ({
  ...r,
  re: new RegExp(
    '^' + String(r.glob || '/').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\\\*\\\*/g, '.*').replace(/\\\*/g, '[^/]*') + '$',
    'i'
  )
}));

const _limitsFor = (pagePath) => {
  for (const r of rules) if (r.re.test(pagePath)) return (r.limits || defaults);
  return defaults;
};

const violations = [];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf-8')); }
  catch (e) {
    console.log(`::error file=${f},line=1::Invalid JSON: ${e.message}`);
    violations.push({ file: f, field: 'json', error: e.message });
    continue;
  }

  const prop = j.proposal || {};
  const pagePath = j.path || '/';
  const { title_max, desc_max } = _limitsFor(pagePath);
  const title = (prop.title || '').trim();
  const desc  = (prop.desc  || '').trim();

  if (title && title.length > title_max) {
    console.log(`::error file=${f},line=1::Title too long (${title.length} > ${title_max})`);
    violations.push({
      file: f, field: 'title', length: title.length, limit: title_max,
      excerpt: title
    });
  }
  if (desc && desc.length > desc_max) {
    console.log(`::error file=${f},line=1::Description too long (${desc.length} > ${desc_max})`);
    violations.push({
      file: f, field: 'description', length: desc.length, limit: desc_max,
      excerpt: desc
    });
  }
}

if (violations.length) {
  const report = { files, violations, defaults, rules: (cfg.rules || []).map(r => ({ glob: r.glob, limits: r.limits })) };
  fs.writeFileSync('guardrails-violations.json', JSON.stringify(report, null, 2));
  console.log(`Wrote guardrails-violations.json with ${violations.length} violation(s).`);
} else {
  console.log('SEO meta guardrails OK (no violations).');
}

process.exit(0);

