#!/usr/bin/env node
/**
 * Resolve reviewers/team_reviewers from a JSON ruleset based on the page path.
 * Usage:
 *   node scripts/seo-meta-reviewers.mjs \
 *     --page "/blog/post/index.html" \
 *     --config ".github/seo-meta-reviewers.json" \
 *     --reviewers "bob,carol" \
 *     --team-reviewers "content"
 *
 * Emits GITHUB_OUTPUT:
 *   reviewers=<comma list>
 *   team_reviewers=<comma list>
 */

import fs from 'fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), (arr[i+1] && !arr[i+1].startsWith('--')) ? arr[i+1] : '']);
    return acc;
  }, [])
);

const PAGE = (args.page || '').trim() || '/';
const CONFIG = args.config || '.github/seo-meta-reviewers.json';

const MANUAL_R = (args.reviewers || '').split(',').map(s => s.trim()).filter(Boolean);
const MANUAL_T = (args['team-reviewers'] || '').split(',').map(s => s.trim()).filter(Boolean);

function out(name, val) {
  console.log(`${name}=${val}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', `${name}=${val}\n`);
}

function toRegex(glob) {
  // Very small glob → regex: '**' => '.*', '*' => '[^/]*'
  let g = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  g = g.replace(/\\\*\\\*/g, '.*').replace(/\\\*/g, '[^/]*');
  if (!g.startsWith('/')) g = '/' + g;
  return new RegExp('^' + g + '$', 'i');
}

function uniq(list) {
  const seen = new Set(); const result = [];
  for (const v of list) {
    const x = (v || '').replace(/^@/, '').trim();
    if (x && !seen.has(x)) { seen.add(x); result.push(x); }
  }
  return result;
}

function main() {
  if (!fs.existsSync(CONFIG)) {
    out('reviewers', MANUAL_R.join(','));
    out('team_reviewers', MANUAL_T.join(','));
    return;
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf-8'));
  const rules = Array.isArray(cfg.rules) ? cfg.rules : [];
  const defaults = cfg.defaults || {};

  let matchedR = [];
  let matchedT = [];

  for (const r of rules) {
    const re = toRegex(String(r.glob || ''));
    if (re.test(PAGE)) {
      matchedR = matchedR.concat(r.reviewers || []);
      matchedT = matchedT.concat(r.team_reviewers || []);
    }
  }
  if (!matchedR.length && !matchedT.length) {
    matchedR = matchedR.concat(defaults.reviewers || []);
    matchedT = matchedT.concat(defaults.team_reviewers || []);
  }

  const reviewers = uniq([...matchedR, ...MANUAL_R]).join(',');
  const team_reviewers = uniq([...matchedT, ...MANUAL_T]).join(',');

  out('reviewers', reviewers);
  out('team_reviewers', team_reviewers);
}

main();
