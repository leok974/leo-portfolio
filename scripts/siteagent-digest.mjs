#!/usr/bin/env node
/**
 * Build a nightly digest with per-page title/desc counts, limit flags, and artifact links.
 * Outputs:
 *   body=<markdown>
 *
 * Args:
 *   --pages  comma list of paths (/index.html,/blog/post/index.html)
 *   --branch PR branch (for autolinks)
 *   --repo   owner/repo
 */

import fs from 'fs';
import path from 'path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => {
  if (!a.startsWith('--')) return [];
  const k = a.slice(2);
  const v = (arr[i+1] && !arr[i+1].startsWith('--')) ? arr[i+1] : '';
  return [[k, v]];
}).filter(Boolean));

const PAGES  = (args.pages || '').split(',').map(s => s.trim()).filter(Boolean);
const BRANCH = args.branch || '';
const REPO   = args.repo   || process.env.GITHUB_REPOSITORY || '';

const APPLY_DIR = path.join(process.cwd(), 'agent', 'artifacts', 'seo-meta-apply');
const CFG_PATH  = path.join(process.cwd(), '.github', 'seo-meta-reviewers.json');

function out(name, val) {
  // emit as GitHub output
  if (name === 'body') {
    const here = `${name}<<EOF\n${val}\nEOF\n`;
    fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', here);
  } else {
    const kv = `${name}=${val}\n`;
    fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', kv);
  }
}

const slugify = (s) => (s || 'page')
  .replace(/^\//,'')
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g,'-')
  .replace(/^-+|-+$/g,'' ) || 'page';

// very small glob→regex
const globToRe = (glob) => {
  let g = String(glob || '/');
  g = g.replace(/[.+^${}()|[\]\\]/g,'\\$&');
  g = g.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
  if (!g.startsWith('/')) g = '/' + g;
  return new RegExp('^' + g + '$', 'i');
};

const cfg = fs.existsSync(CFG_PATH) ? JSON.parse(fs.readFileSync(CFG_PATH,'utf-8')) : {};
const defaults = (cfg.defaults && cfg.defaults.limits) || { title_max: 60, desc_max: 155 };
const rules = (cfg.rules || []).map(r => ({ glob: r.glob, limits: r.limits, re: globToRe(r.glob || '/') }));

function limitsFor(page) {
  for (const r of rules) if (r.re.test(page)) return r.limits || defaults;
  return defaults;
}

function link(rel) {
  if (!REPO || !BRANCH || !rel) return rel || '';
  return `https://github.com/${REPO}/blob/${BRANCH}/${rel}`;
}

function readApplyFor(page) {
  const slug = slugify(page);
  const p = path.join(APPLY_DIR, `${slug}.apply.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function buildRow(page) {
  const limits = limitsFor(page);
  const ap = readApplyFor(page);
  const proposal = ap?.proposal || {};
  const t = (proposal.title || '').trim();
  const d = (proposal.desc  || '').trim();
  const tl = t.length, dl = d.length;
  const tOk = tl <= (limits.title_max ?? 60);
  const dOk = dl <= (limits.desc_max ?? 155);

  const relApply = ap ? path.relative(process.cwd(), path.join(APPLY_DIR, `${slugify(page)}.apply.json`)) : '';
  const relDiff  = ap ? path.relative(process.cwd(), path.join(APPLY_DIR, `${slugify(page)}.diff`)) : '';
  const relPrev  = ap ? path.relative(process.cwd(), path.join(APPLY_DIR, `${slugify(page)}.preview.html`)) : '';
  const links = [
    relApply && `[apply](${link(relApply)})`,
    fs.existsSync(path.join(APPLY_DIR, `${slugify(page)}.diff`)) && `[diff](${link(relDiff)})`,
    fs.existsSync(path.join(APPLY_DIR, `${slugify(page)}.preview.html`)) && `[preview](${link(relPrev)})`,
  ].filter(Boolean).join(' · ');

  const flag = (ok) => ok ? '✅' : '🚫';
  return {
    page,
    tMsg: `${flag(tOk)} ${tl}/${limits.title_max}`,
    dMsg: `${flag(dOk)} ${dl}/${limits.desc_max}`,
    links,
    over: (tOk ? 0 : 1) + (dOk ? 0 : 1),
    title: t, desc: d,
  };
}

(function main() {
  if (!PAGES.length) {
    out('body', 'No pages were selected.');
    return;
  }
  const rows = PAGES.map(buildRow);
  const overCount = rows.reduce((n, r) => n + (r.over > 0 ? 1 : 0), 0);
  const pagesCount = rows.length;
  const allOk = pagesCount > 0 && overCount === 0;

  const md = [
    `### 🤖 Nightly SEO Meta Digest`,
    ``,
    `**Pages:** ${PAGES.length} · **Over-limit:** ${overCount}`,
    ``,
    `| Page | Title (len/limit) | Description (len/limit) | Artifacts |`,
    `|------|--------------------|--------------------------|-----------|`,
    ...rows.map(r => `| \`${r.page}\` | ${r.tMsg} | ${r.dMsg} | ${r.links || '—'} |`),
    ``,
    `_Limits come from \`.github/seo-meta-reviewers.json\` (defaults 60/155). Artifacts live under \`agent/artifacts/seo-meta-apply/\`._`,
  ].join('\n');

  out('body', md);
  out('all_ok', String(allOk));
  out('pages_count', String(pagesCount));
  out('over_count', String(overCount));
})();
