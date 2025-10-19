/**
 * Skills Generator
 *
 * Generates skills.json from projects.json using skills.map.json for categorization.
 *
 * Copilot: Always run pnpm projects:sync && pnpm skills:gen before building.
 * Skills must be sourced from the latest apps/portfolio-ui/public/projects.json,
 * using skills.map.json for synonyms and categories. Never hardcode skills in JSX—
 * render from skills.json. When a project is added/removed, rebuild to refresh skills.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const PUB = 'apps/portfolio-ui/public';

const readJson = async (p, dflt=undefined) => {
  try { 
    const content = await fs.readFile(p,'utf8');
    return JSON.parse(content);
  } catch (e) { 
    console.error(`✗ readJson failed for ${p}: ${e.message}`);
    return dflt; 
  }
};

const normalize = s => String(s || '').trim().toLowerCase();

const mapSkill = (raw, map) => {
  const key = normalize(raw);
  // direct key
  if (map[key]) return map[key];
  // synonym hit
  for (const k of Object.keys(map)) {
    const syn = map[k].syn || [];
    if (syn.map(normalize).includes(key)) return map[k];
  }
  // default: titleize
  return { name: raw, cat: 'misc' };
};

(async () => {
  const projectsPath = path.join(PUB, 'projects.json');
  const projects = await readJson(projectsPath, []);
  
  if (!projects?.length) {
    console.error(`✗ skills-generate: projects.json is empty or missing`);
    console.error(`  Path checked: ${projectsPath}`);
    console.error(`  Absolute: ${path.resolve(projectsPath)}`);
    try {
      const stat = await fs.stat(projectsPath);
      console.error(`  File exists, size: ${stat.size} bytes`);
    } catch (e) {
      console.error(`  File does not exist: ${e.message}`);
    }
    throw new Error('skills-generate: projects.json empty or missing');
  }

  const cfg = await readJson('skills.map.json');
  const catNames = cfg.categories;
  const mapper = cfg.map || {};
  const pinFirst = cfg.pinFirst || [];

  // collect skills from tags + stack
  const tally = new Map(); // name -> { name, cat, count }
  const bump = (skill) => {
    const k = skill.name;
    tally.set(k, { ...skill, count: (tally.get(k)?.count || 0) + 1 });
  };

  for (const p of projects) {
    const rawSkills = [
      ...(p.tags || []),
      ...(p.stack || [])
    ].filter(Boolean);

    for (const rs of rawSkills) bump(mapSkill(rs, mapper));
  }

  // group by category
  const grouped = {};
  for (const { name, cat, count } of tally.values()) {
    const catLabel = catNames[cat] || catNames['misc'];
    grouped[catLabel] ||= [];
    grouped[catLabel].push({ name, count });
  }

  // sort: pinned first, then by frequency desc
  const order = new Map(pinFirst.map((n, i) => [n, i]));
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => {
      const pa = order.has(a.name) ? -1000 + order.get(a.name) : 0;
      const pb = order.has(b.name) ? -1000 + order.get(b.name) : 0;
      if (pa !== pb) return pa - pb;
      return b.count - a.count || a.name.localeCompare(b.name);
    });
  }

  // write public JSON
  await fs.writeFile(path.join(PUB, 'skills.json'), JSON.stringify(grouped, null, 2));
  console.log(`✅ skills-generate: wrote ${Object.values(grouped).flat().length} skills across ${Object.keys(grouped).length} categories`);
})();
