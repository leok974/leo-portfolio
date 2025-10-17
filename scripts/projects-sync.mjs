#!/usr/bin/env node
/**
 * scripts/projects-sync.mjs
 *
 * Fetches GitHub repositories for the configured org/user and generates data/projects.json
 * Uses projects.config.json to filter by topics, exclude archived repos, etc.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... node scripts/projects-sync.mjs
 *   or
 *   pnpm projects:sync
 */

import fs from 'node:fs/promises';

const cfg = JSON.parse(await fs.readFile('projects.config.json', 'utf8'));
const token = process.env.GITHUB_TOKEN;

async function gh(url) {
  const r = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

const base = `https://api.github.com/users/${cfg.org}/repos?per_page=100&sort=updated`;
let repos = await gh(base);

const out = [];
for (const r of repos) {
  if (cfg.exclude_archived && r.archived) continue;
  if (cfg.denylist.some(d => new RegExp('^' + d.replace('*', '.*') + '$').test(r.name))) continue;

  // topics
  const topics = await gh(r.url + '/topics');
  const names = topics.names || [];
  if (cfg.include_topics.length && !names.some(x => cfg.include_topics.includes(x))) continue;

  out.push({
    slug: r.name.toLowerCase(),
    title: r.name.replace(/[-_]/g, ' '),
    one_liner: r.description || '',
    tags: names,
    stack: [],
    url: r.homepage || r.html_url,
    stars: r.stargazers_count,
    updated_at: r.updated_at,
    show: true
  });
}

await fs.mkdir('data', { recursive: true });
await fs.writeFile('data/projects.json', JSON.stringify(out, null, 2));
console.log(`projects-sync: wrote ${out.length} projects`);
