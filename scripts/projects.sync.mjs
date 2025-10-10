#!/usr/bin/env node
/**
 * Projects Sync: GitHub → projects.json (+ regenerate pages) → open PR
 *
 * Env:
 *  - GITHUB_TOKEN       (required; classic PAT or fine-grained w/ repo read/write)
 *  - GH_OWNER           (default: infer from git remote)
 *  - GH_REPO            (default: infer from git remote)
 *  - SYNC_INCLUDE_FORKS (default: "false")
 *  - SYNC_MAX_REPOS     (optional, e.g. "30")
 *
 * CLI:
 *  --dry-run            Show planned changes, do not write or open PR
 *  --base <branch>      Default: repo default branch
 *  --branch <name>      Default: "chore/projects-sync-YYYYMMDD-HHMMSS"
 *  --only <csv>         Limit to these repo names (owner/repo or repo)
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Octokit } from "octokit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const log = (...a) => console.log("[projects.sync]", ...a);
const err = (...a) => console.error("[projects.sync]", ...a);

const args = new Set(process.argv.slice(2));
const getArg = (flag, def=null) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i+1] : def;
};
const DRY = args.has("--dry-run");
const EXPLICIT_BASE = getArg("--base", null);
const EXPLICIT_BRANCH = getArg("--branch", null);
const ONLY = getArg("--only", null)?.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) ?? [];

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) {
  err("Missing GITHUB_TOKEN (or GH_TOKEN).");
  process.exit(2);
}

// Infer owner/repo from git remote if not provided
function inferRepo() {
  try {
    const remote = execSync('git remote get-url origin', { stdio: ['ignore','pipe','pipe'] })
      .toString().trim();
    // Accept https or ssh
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    const mHttps = remote.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/i);
    if (mHttps) return { owner: mHttps[1], repo: mHttps[2] };
  } catch {}
  return null;
}

const inferred = inferRepo() || {};
const OWNER = process.env.GH_OWNER || inferred.owner;
const REPO  = process.env.GH_REPO  || inferred.repo;
if (!OWNER || !REPO) {
  err("Cannot infer GH owner/repo. Set GH_OWNER and GH_REPO.");
  process.exit(2);
}

const INCLUDE_FORKS = (process.env.SYNC_INCLUDE_FORKS || "false").toLowerCase() === "true";
const MAX_REPOS = parseInt(process.env.SYNC_MAX_REPOS || "0", 10) || null;

const octo = new Octokit({ auth: token });

// ---------- GitHub fetch ----------
async function fetchRepos(owner) {
  // list repos for user (public); if this is org, this also works with proper perms
  const repos = [];
  let page = 1;
  while (true) {
    const { data } = await octo.request('GET /users/{owner}/repos', {
      owner,
      per_page: 100,
      page,
      sort: 'updated'
    });
    if (!data?.length) break;
    repos.push(...data);
    if (MAX_REPOS && repos.length >= MAX_REPOS) break;
    page++;
  }
  return repos.slice(0, MAX_REPOS || repos.length);
}

async function enrich(repo) {
  // topics + languages
  const [{ data: topics }, { data: languages }] = await Promise.all([
    octo.request('GET /repos/{owner}/{repo}/topics', { owner: repo.owner.login, repo: repo.name, mediaType: { previews: ['mercy'] } }),
    octo.request('GET /repos/{owner}/{repo}/languages', { owner: repo.owner.login, repo: repo.name }),
  ]);
  return { topics: topics.names ?? [], languages: Object.keys(languages ?? {}) };
}

// ---------- Normalize ----------
function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeRepo(r, extra) {
  // Map → projects.json shape used in README's Copilot prompt
  // { slug, title, summary, tags[], cats[], thumbnail, poster, sources[], links, stars, topics }
  const tags = [...new Set([...(extra.topics||[]), ...(extra.languages||[]).map(l=>l.toLowerCase())])];
  const cats = []; // optional buckets like ["AI Agents","DevOps"]; leave empty for manual curation
  const sources = [`https://github.com/${r.owner.login}/${r.name}`];
  const links = r.homepage ? [r.homepage] : [];
  return {
    slug: toSlug(r.name),
    title: r.name,
    summary: r.description || "—",
    tags,
    cats,
    thumbnail: `assets/${toSlug(r.name)}.webp`, // convention; may not exist yet
    poster: `assets/${toSlug(r.name)}.webm`,    // convention; may not exist yet
    sources,
    links,
    stars: r.stargazers_count || 0,
    topics: extra.topics || []
  };
}

// ---------- Disk helpers ----------
const ROOT = resolve(__dirname, "..");
const PROJECTS_JSON = resolve(ROOT, "projects.json");
const PROJECTS_DIR = resolve(ROOT, "projects");
const GENERATOR_JS = resolve(ROOT, "generate-projects.js");

function readJsonSafe(p) {
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8"));
}

function sortProjects(arr) {
  // Star-desc, fallback alpha
  return [...arr].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || a.title.localeCompare(b.title));
}

function computeHash(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// ---------- Main ----------
(async function main() {
  log(`Repo: ${OWNER}/${REPO}`);
  const onlySet = new Set(ONLY);

  // 1) Fetch repos → filter
  const baseRepos = await fetchRepos(OWNER);
  const filtered = baseRepos.filter(r => {
    if (!INCLUDE_FORKS && r.fork) return false;
    if (ONLY.length) {
      const full = `${r.owner.login}/${r.name}`.toLowerCase();
      const short = r.name.toLowerCase();
      if (!onlySet.has(full) && !onlySet.has(short)) return false;
    }
    return !r.archived && !r.private; // public, active
  });

  // 2) Enrich + normalize
  const enriched = [];
  for (const r of filtered) {
    const extra = await enrich(r).catch(() => ({ topics: [], languages: [] }));
    enriched.push(normalizeRepo(r, extra));
  }
  const normalized = sortProjects(enriched);

  // 3) Diff projects.json
  const before = readJsonSafe(PROJECTS_JSON) || [];
  const beforeStr = JSON.stringify(before, null, 2);
  const afterStr  = JSON.stringify(normalized, null, 2);
  const beforeHash = computeHash(Buffer.from(beforeStr));
  const afterHash  = computeHash(Buffer.from(afterStr));
  const changed = beforeHash !== afterHash;

  // 4) If dry-run → print summary + exit 0
  if (DRY) {
    const beforeTitles = new Set(before.map(p => p.title));
    const afterTitles  = new Set(normalized.map(p => p.title));
    const added = [...afterTitles].filter(t => !beforeTitles.has(t));
    const removed = [...beforeTitles].filter(t => !afterTitles.has(t));
    console.log(JSON.stringify({
      dry_run: true,
      changed,
      added,
      removed,
      count_before: before.length,
      count_after: normalized.length
    }, null, 2));
    return;
  }

  // 5) Write projects.json
  writeFileSync(PROJECTS_JSON, afterStr + "\n", "utf-8");
  log(`projects.json updated (${before.length} → ${normalized.length})`);

  // 6) Regenerate pages (if generator exists)
  if (existsSync(GENERATOR_JS)) {
    log("Regenerating /projects pages…");
    execSync(`node "${GENERATOR_JS}"`, { cwd: ROOT, stdio: "inherit" });
  } else {
    log("No generator found; skipping page generation.");
  }

  // 7) Git plumbing (commit on branch) + PR
  const { data: repoMeta } = await octo.request('GET /repos/{owner}/{repo}', { owner: OWNER, repo: REPO });
  const base = EXPLICIT_BASE || repoMeta.default_branch;
  const branchName = EXPLICIT_BRANCH || `chore/projects-sync-${new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,12)}`;

  // stage all changes under projects.json + /projects
  execSync(`git add "${PROJECTS_JSON}"`, { cwd: ROOT });
  if (existsSync(PROJECTS_DIR)) execSync(`git add "${PROJECTS_DIR}"`, { cwd: ROOT });

  // no-op check (in case generator didn't change files)
  const diffExit = (() => { try { execSync('git diff --cached --quiet', { cwd: ROOT }); return 0; } catch { return 1; } })();
  if (diffExit === 0) {
    log("No staged changes; nothing to commit. Exiting.");
    return;
  }

  // ensure we have the latest base
  execSync(`git fetch origin ${base} --quiet || true`, { cwd: ROOT, stdio: 'ignore' });

  // create branch and commit
  try { execSync(`git checkout -b ${branchName}`, { cwd: ROOT, stdio: 'ignore' }); }
  catch { execSync(`git checkout ${branchName}`, { cwd: ROOT, stdio: 'ignore' }); }
  execSync(`git commit -m "chore(projects): sync from GitHub (auto)"`, { cwd: ROOT, stdio: 'inherit' });
  execSync(`git push -u origin ${branchName}`, { cwd: ROOT, stdio: 'inherit' });

  // open PR via API
  const { data: pr } = await octo.request('POST /repos/{owner}/{repo}/pulls', {
    owner: OWNER, repo: REPO,
    title: `Projects sync: ${new Date().toISOString().slice(0,10)}`,
    head: branchName,
    base,
    body: [
      "Automated projects sync:",
      "- Fetched GitHub topics, stars, languages",
      "- Normalized `projects.json`",
      "- Regenerated `/projects/*.html`",
    ].join("\n")
  });

  // Machine-readable for CI:
  console.log(`outputs_uri=${pr.html_url}`);
  log(`Opened PR: ${pr.html_url}`);
})().catch(e => {
  err(e?.stack || e?.message || String(e));
  process.exit(1);
});
