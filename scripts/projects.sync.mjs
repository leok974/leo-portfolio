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

// PR cosmetics / ownership
const PR_LABELS = (process.env.PR_LABELS || "automation,projects-sync")
  .split(",").map(s=>s.trim()).filter(Boolean);
const PR_ASSIGNEES = (process.env.PR_ASSIGNEES || "").split(",").map(s=>s.trim()).filter(Boolean);
const PR_COMMENT_EVERY_RUN = (process.env.PR_COMMENT_EVERY_RUN || "true").toLowerCase() === "true";

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

  // For status block: compute added/removed titles
  const beforeTitles = new Set(before.map(p => p.title));
  const afterTitles  = new Set(normalized.map(p => p.title));
  const addedTitles  = [...afterTitles].filter(t => !beforeTitles.has(t));
  const removedTitles= [...beforeTitles].filter(t => !afterTitles.has(t));

  // 4) If dry-run → print summary + exit 0
  if (DRY) {
    console.log(JSON.stringify({
      dry_run: true,
      changed,
      added: addedTitles,
      removed: removedTitles,
      count_before: before.length,
      count_after: normalized.length
    }, null, 2));
    return;
  }

  // 4.5) Fast-exit path when there are NO changes:
  if (!changed) {
    // Try to find an existing open stable PR to update a "No changes" status; else a closed-but-unmerged to reopen & update.
    const stableBranch = "chore/projects-sync";
    const repoMeta = await octo.request('GET /repos/{owner}/{repo}', { owner: OWNER, repo: REPO });
    const base = EXPLICIT_BASE || repoMeta.data.default_branch;

    let pr = null;
    try {
      const openStable = await octo.request('GET /repos/{owner}/{repo}/pulls', {
        owner: OWNER, repo: REPO, state: 'open', head: `${OWNER}:${stableBranch}`, base, per_page: 1
      }).then(r => r.data?.[0]).catch(() => null);
      if (openStable) {
        pr = openStable;
      } else {
        const closedStable = await octo.request('GET /repos/{owner}/{repo}/pulls', {
          owner: OWNER, repo: REPO, state: 'closed', head: `${OWNER}:${stableBranch}`, base, per_page: 1
        }).then(r => r.data?.[0]).catch(() => null);
        if (closedStable && !closedStable.merged_at) {
          // Reopen to keep a single rolling PR that reflects latest status (even for "no changes")
          const reopened = await octo.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner: OWNER, repo: REPO, pull_number: closedStable.number, state: 'open'
          });
          pr = reopened.data;
          log(`Reopened PR (no-change status): ${pr.html_url}`);
        }
      }
    } catch (e) {
      err("Fast-exit PR lookup/reopen failed:", e.status || e.message || e);
    }

    // Prepare a minimal status block update
    const now = new Date();
    const stamp = now.toISOString().replace('T',' ').replace('Z',' UTC');
    const statusBlock = [
      "<!-- projects-sync:status:start -->",
      "### Sync Status",
      `- **When:** ${stamp}`,
      `- **Changed:** no`,
      `- **Projects:** ${before.length} → ${normalized.length}`,
      `- **Added (0):**`,
      "- none",
      `- **Removed (0):**`,
      "- none",
      `- **Pages regenerated:** no`,
      "<!-- projects-sync:status:end -->"
    ].join("\n");

    if (pr) {
      try {
        const currentBody = pr.body || "";
        const withBlock = /<!-- projects-sync:status:start -->[\s\S]*<!-- projects-sync:status:end -->/m.test(currentBody)
          ? currentBody.replace(/<!-- projects-sync:status:start -->[\s\S]*<!-- projects-sync:status:end -->/m, statusBlock)
          : (currentBody ? currentBody + "\n\n---\n\n" : "") + statusBlock;
        if (withBlock !== currentBody) {
          await octo.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner: OWNER, repo: REPO, pull_number: pr.number, body: withBlock
          });
          log("Updated PR body status block (no changes).");
        }
        if (PR_COMMENT_EVERY_RUN) {
          await octo.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
            owner: OWNER, repo: REPO, issue_number: pr.number,
            body: `Sync run @ ${stamp}\n• changed: no\n• projects: ${before.length} → ${normalized.length}\n• pages regenerated: no`
          });
          log("Posted run summary comment (no changes).");
        }
        // Emit outputs_uri so CI can still capture the PR URL if needed.
        console.log(`outputs_uri=${pr.html_url}`);
      } catch (e) {
        err("Failed updating PR (no changes):", e.status || e.message || e);
      }
    } else {
      log("No changes; no existing sync PR to update. Exiting cleanly.");
      // Deliberately not emitting outputs_uri here (no PR to reference).
    }
    return;
  }

  // 5) Write projects.json
  writeFileSync(PROJECTS_JSON, afterStr + "\n", "utf-8");
  log(`projects.json updated (${before.length} → ${normalized.length})`);

  // 6) Regenerate pages (if generator exists)
  let pagesRegenerated = false;
  if (existsSync(GENERATOR_JS)) {
    log("Regenerating /projects pages…");
    execSync(`node "${GENERATOR_JS}"`, { cwd: ROOT, stdio: "inherit" });
    pagesRegenerated = true;
  } else {
    log("No generator found; skipping page generation.");
  }

  // 7) Git plumbing (commit on branch) + PR
  const { data: repoMeta } = await octo.request('GET /repos/{owner}/{repo}', { owner: OWNER, repo: REPO });
  const base = EXPLICIT_BASE || repoMeta.default_branch;
  // Prefer a stable branch to enable PR reuse; fall back to timestamp when no open PR exists.
  const stableBranch = "chore/projects-sync";
  let branchName = EXPLICIT_BRANCH || stableBranch;

  // If an open PR already exists for the stable branch, reuse it; otherwise we may create a new one later.
  const existingForStable = await octo.request('GET /repos/{owner}/{repo}/pulls', {
    owner: OWNER,
    repo: REPO,
    state: 'open',
    head: `${OWNER}:${stableBranch}`,
    base
  }).then(r => r.data?.[0]).catch(() => null);

  // Track a closed-but-unmerged PR for the stable branch (candidate to reopen)
  let closedUnmergedStable = null;
  if (!existingForStable && !EXPLICIT_BRANCH) {
    const closed = await octo.request('GET /repos/{owner}/{repo}/pulls', {
      owner: OWNER,
      repo: REPO,
      state: 'closed',
      head: `${OWNER}:${stableBranch}`,
      base,
      per_page: 1
    }).then(r => r.data?.[0]).catch(() => null);
    if (closed && !closed.merged_at) {
      closedUnmergedStable = closed; // we will reopen this one after pushing commits
      branchName = stableBranch;
    } else {
      // No open or reopenable stable PR → use unique branch for a fresh PR
      branchName = `chore/projects-sync-${new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,12)}`;
    }
  }

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

  // create/switch branch and commit
  try {
    execSync(`git checkout -b ${branchName}`, { cwd: ROOT, stdio: 'ignore' });
  } catch {
    // Branch exists locally; just check it out.
    execSync(`git checkout ${branchName}`, { cwd: ROOT, stdio: 'ignore' });
  }
  execSync(`git commit -m "chore(projects): sync from GitHub (auto)"`, { cwd: ROOT, stdio: 'inherit' });
  // Push (create or update). Use --set-upstream on first push, fall back to a normal push if already tracking.
  try {
    execSync(`git push -u origin ${branchName}`, { cwd: ROOT, stdio: 'inherit' });
  } catch {
    execSync(`git push origin ${branchName}`, { cwd: ROOT, stdio: 'inherit' });
  }

  // Reuse PR if open; else try to reopen a previously closed-but-unmerged stable PR; else create new.
  let pr = null;
  const existing = await octo.request('GET /repos/{owner}/{repo}/pulls', {
    owner: OWNER,
    repo: REPO,
    state: 'open',
    head: `${OWNER}:${branchName}`,
    base
  }).then(r => r.data?.[0]).catch(() => null);

  if (existing) {
    pr = existing;
    log(`Reusing open PR: ${pr.html_url}`);
  } else if (closedUnmergedStable && branchName === stableBranch) {
    try {
      // Reopen the closed PR (only possible if it wasn't merged)
      const reopened = await octo.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner: OWNER, repo: REPO, pull_number: closedUnmergedStable.number, state: 'open'
      });
      pr = reopened.data;
      log(`Reopened PR: ${pr.html_url}`);
    } catch (_e) {
      // Fall back to creating a new PR if reopen failed (e.g., insufficient perms or locked)
      log(`Could not reopen closed PR #${closedUnmergedStable.number}; creating a new one…`);
    }
  }

  if (!pr) {
    const created = await octo.request('POST /repos/{owner}/{repo}/pulls', {
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
    pr = created.data;
    log(`Opened PR: ${pr.html_url}`);

    // Apply labels and assignees
    if (PR_LABELS.length > 0) {
      try {
        await octo.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
          owner: OWNER, repo: REPO, issue_number: pr.number, labels: PR_LABELS
        });
        log(`Applied labels: ${PR_LABELS.join(", ")}`);
      } catch (err) {
        log(`Warning: Failed to apply labels: ${err.message}`);
      }
    }
    if (PR_ASSIGNEES.length > 0) {
      try {
        await octo.request('POST /repos/{owner}/{repo}/issues/{issue_number}/assignees', {
          owner: OWNER, repo: REPO, issue_number: pr.number, assignees: PR_ASSIGNEES
        });
        log(`Assigned to: ${PR_ASSIGNEES.join(", ")}`);
      } catch (err) {
        log(`Warning: Failed to assign: ${err.message}`);
      }
    }
  }

  // ---------- Upsert "Status" block in PR body ----------
  const now = new Date();
  const stamp = now.toISOString().replace('T',' ').replace('Z',' UTC');
  const list = (arr, max=10) => {
    const a = arr.slice(0, max);
    return a.length ? a.map(s=>`- ${s}`).join("\n") + (arr.length>max?`\n- …and ${arr.length-max} more`: "") : "- none";
  };
  const statusBlock = [
    "<!-- projects-sync:status:start -->",
    "### Sync Status",
    `- **When:** ${stamp}`,
    `- **Changed:** ${changed ? "yes" : "no"}`,
    `- **Projects:** ${before.length} → ${normalized.length}`,
    `- **Added (${addedTitles.length}):**`,
    list(addedTitles),
    `- **Removed (${removedTitles.length}):**`,
    list(removedTitles),
    `- **Pages regenerated:** ${pagesRegenerated ? "yes" : "no"}`,
    "<!-- projects-sync:status:end -->"
  ].join("\n");

  try {
    const currentBody = pr.body || "";
    let newBody;
    if (/<!-- projects-sync:status:start -->[\s\S]*<!-- projects-sync:status:end -->/m.test(currentBody)) {
      // replace existing block
      newBody = currentBody.replace(/<!-- projects-sync:status:start -->[\s\S]*<!-- projects-sync:status:end -->/m, statusBlock);
    } else {
      // append status block separated by a ruler
      newBody = (currentBody ? currentBody + "\n\n---\n\n" : "")
        + statusBlock;
    }
    if (newBody !== currentBody) {
      await octo.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner: OWNER, repo: REPO, pull_number: pr.number, body: newBody
      });
      log("Updated PR body status block.");
    }
  } catch (e) {
    err("Failed updating PR body:", e.status || e.message || e);
  }

  // Optional: log a short comment each run (useful for notifications)
  if (PR_COMMENT_EVERY_RUN) {
    try {
      const summary = [
        `Sync run @ ${stamp}`,
        `• changed: ${changed ? "yes" : "no"}`,
        `• projects: ${before.length} → ${normalized.length}`,
        `• added: ${addedTitles.length}, removed: ${removedTitles.length}`,
        `• pages regenerated: ${pagesRegenerated ? "yes" : "no"}`
      ].join("\n");
      await octo.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner: OWNER, repo: REPO, issue_number: pr.number, body: summary
      });
      log("Posted run summary comment.");
    } catch (e) {
      err("Failed to post PR comment:", e.status || e.message || e);
    }
  }

  // Always emit machine-readable output for CI parse
  console.log(`outputs_uri=${pr.html_url}`);
})().catch(e => {
  err(e?.stack || e?.message || String(e));
  process.exit(1);
});
