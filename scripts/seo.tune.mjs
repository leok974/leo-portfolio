#!/usr/bin/env node
/**
 * SEO Tune "autofix": scan HTML files, apply safe meta fixes, open draft PR.
 *
 * Safe edits (idempotent):
 *  - Title: ensure 30–70 chars (trim if >70, don't invent titles)
 *  - Meta description: add iff missing/empty, from first paragraph (max 160)
 *  - Canonical: add iff missing; from SITE_BASE_URL + path (env)
 *  - Open Graph: ensure og:title/og:description match <title> / meta[name=description]
 *
 * Env:
 *  - GITHUB_TOKEN (required)
 *  - GH_OWNER / GH_REPO (optional; inferred from git remote)
 *  - SITE_BASE_URL (e.g., https://leok.dev)  -> used for canonical if missing
 *  - SEO_GLOBS (comma list; default: "public/**/*.html,src/**/*.html")
 *  - PR_LABELS (default "automation,needs-approval,seo-tune")
 *  - PR_ASSIGNEES (csv; optional)
 *  - PR_DRAFT (default "true")
 *
 * CLI:
 *  --dry-run       No writes; prints JSON diff summary
 *  --base <name>   Base branch (default repo default)
 *  --branch <name> Force branch name (else chore/seo-tune-YYYYMMDD-HHMM)
 *  --only <csv>    Limit to subset of file paths (post-globbing exact filter)
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { glob } from "glob";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { Octokit } from "octokit";
import cheerio from "cheerio";

const log = (...a) => console.log("[seo.tune]", ...a);
const err = (...a) => console.error("[seo.tune]", ...a);

const argv = process.argv;
const has = f => argv.includes(f);
const val = (f, d=null) => { const i = argv.indexOf(f); return i>-1 ? argv[i+1] : d; };

const DRY = has("--dry-run");
const STRICT = has("--strict");
const REQUIRE_PR = has("--require-pr");
const ONLY_CHANGED = has("--only-changed");
const CHANGED_BASE = val("--changed-base", "origin/main"); // default to origin/main per request
const EXPLICIT_BASE = val("--base", null);
const EXPLICIT_BRANCH = val("--branch", null);
const ONLY = (val("--only", "")||"").split(",").map(s=>s.trim()).filter(Boolean);

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) { err("Missing GITHUB_TOKEN."); process.exit(2); }
const octo = new Octokit({ auth: token });

function inferRepo() {
  try {
    const remote = execSync('git remote get-url origin', { stdio: ['ignore','pipe','pipe'] }).toString().trim();
    const m = remote.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/i);
    if (m) return { owner: m[1], repo: m[2] };
  } catch {}
  return {};
}
const inferred = inferRepo();
const OWNER = process.env.GH_OWNER || inferred.owner;
const REPO  = process.env.GH_REPO  || inferred.repo;
if (!OWNER || !REPO) { err("Cannot infer GH owner/repo. Set GH_OWNER and GH_REPO."); process.exit(2); }

const PR_LABELS = (process.env.PR_LABELS || "automation,needs-approval,seo-tune").split(",").map(s=>s.trim()).filter(Boolean);
const PR_ASSIGNEES = (process.env.PR_ASSIGNEES || "").split(",").map(s=>s.trim()).filter(Boolean);
const PR_DRAFT = (process.env.PR_DRAFT || "true").toLowerCase() === "true";
const SITE_BASE_URL = (process.env.SITE_BASE_URL || "").replace(/\/+$/,""); // no trailing slash
const GLOBS = (process.env.SEO_GLOBS || "public/**/*.html,src/**/*.html").split(",").map(s=>s.trim()).filter(Boolean);
const IGNORE_FILE = ".seo-tuneignore";

const TITLE_MIN = 30, TITLE_MAX = 70;
const DESC_MAX = 160;

function sha256(s) { return crypto.createHash("sha256").update(s).digest("hex").slice(0,8); }

function safeTrimTitle(t) {
  const s = (t || "").trim().replace(/\s+/g," ");
  if (!s) return s;
  if (s.length <= TITLE_MAX) return s;
  // cut on word boundary close to max
  let cut = s.slice(0, TITLE_MAX);
  const sp = cut.lastIndexOf(" ");
  if (sp > TITLE_MIN) cut = cut.slice(0, sp);
  return cut;
}

function deriveDescription($) {
  // only derive if missing/empty
  const explicit = $('meta[name="description"]').attr("content")?.trim();
  if (explicit) return explicit;
  // Use first meaningful paragraph text
  const para = $("p").first().text().trim().replace(/\s+/g," ");
  if (!para) return "";
  return para.length > DESC_MAX ? para.slice(0, DESC_MAX-1) + "…" : para;
}

function ensureCanonical($, filePath) {
  const existing = $('link[rel="canonical"]').attr("href");
  if (existing) return existing;
  if (!SITE_BASE_URL) return null;
  // Guess path from file path: try to map /public/foo/index.html → /foo/
  const parts = filePath.split(path.sep);
  const idx = parts.lastIndexOf("public");
  let rel = "";
  if (idx >= 0) {
    rel = "/" + parts.slice(idx+1).join("/"); // after /public
  } else {
    // fallback: relative from repo root, best-effort
    rel = "/" + filePath.replaceAll("\\","/").replace(/^\//,"");
  }
  rel = rel.replace(/index\.html$/,"").replace(/\/+$/,"/"); // prefer trailing slash
  return SITE_BASE_URL + rel;
}

function ensureOg($, title, desc) {
  const ogt = $('meta[property="og:title"]');
  if (title && (!ogt.length || (ogt.attr("content")||"").trim() !== title)) {
    if (ogt.length) ogt.attr("content", title); else $('head').append(`<meta property="og:title" content="${title}">`);
  }
  const ogd = $('meta[property="og:description"]');
  if (desc && (!ogd.length || (ogd.attr("content")||"").trim() !== desc)) {
    if (ogd.length) ogd.attr("content", desc); else $('head').append(`<meta property="og:description" content="${desc}">`);
  }
}

function ensureOgType($) {
  // safe default for static pages; authors can override
  const key = 'meta[property="og:type"]';
  const el = $(key);
  if (!el.length) { $('head').append('<meta property="og:type" content="website">'); return true; }
  const cur = (el.attr("content") || "").trim();
  if (!cur) { el.attr("content", "website"); return true; }
  return false;
}

function ensureOgUrl($, filePath, canonicalHref) {
  const ogu = $('meta[property="og:url"]');
  let url = canonicalHref;
  if (!url && SITE_BASE_URL) {
    // build from file path
    const parts = filePath.split(path.sep);
    const idx = parts.lastIndexOf("public");
    let rel = "";
    if (idx >= 0) rel = "/" + parts.slice(idx+1).join("/");
    else rel = "/" + filePath.replaceAll("\\","/").replace(/^\//,"");
    rel = rel.replace(/index\.html$/,"").replace(/\/+$/,"/");
    url = SITE_BASE_URL + rel;
  }
  if (!url) return false;
  const cur = (ogu.attr("content")||"").trim();
  if (!ogu.length) { $('head').append(`<meta property="og:url" content="${url}">`); return true; }
  if (cur !== url) { ogu.attr("content", url); return true; }
  return false;
}

function ensureTwitterCard($) {
  // Use a safe default; do not add image here (content authors can).
  const tc = $('meta[name="twitter:card"]');
  const desired = "summary_large_image";
  if (!tc.length) { $('head').append(`<meta name="twitter:card" content="${desired}">`); return true; }
  const cur = (tc.attr("content")||"").trim();
  if (!cur) { tc.attr("content", desired); return true; }
  return false;
}

function ensureTwitterParity($, title, desc) {
  let changed = false;
  const tTitle = $('meta[name="twitter:title"]');
  const tDesc  = $('meta[name="twitter:description"]');
  if (title) {
    if (!tTitle.length) { $('head').append(`<meta name="twitter:title" content="${title}">`); changed = true; }
    else if ((tTitle.attr("content")||"").trim() !== title) { tTitle.attr("content", title); changed = true; }
  }
  if (desc) {
    if (!tDesc.length) { $('head').append(`<meta name="twitter:description" content="${desc}">`); changed = true; }
    else if ((tDesc.attr("content")||"").trim() !== desc) { tDesc.attr("content", desc); changed = true; }
  }
  return changed;
}

function dedupeMeta($) {
  // Remove exact-duplicate meta name/property entries keeping first occurrence
  // key = (name|property) + '::' + content (case-sensitive for content)
  const seen = new Set();
  const removed = [];
  $('meta').each((i, el) => {
    const $el = $(el);
    const name = ($el.attr('name') || "").trim().toLowerCase();
    const prop = ($el.attr('property') || "").trim().toLowerCase();
    const content = ($el.attr('content') || "").trim();
    const key = (name ? `n:${name}` : prop ? `p:${prop}` : null);
    if (!key) return;
    const sig = `${key}::${content}`;
    if (seen.has(sig)) {
      removed.push(sig);
      $el.remove();
    } else {
      seen.add(sig);
    }
  });
  return removed.length > 0 ? removed : null;
}

function enforceOneH1($) {
  const h1s = $('h1');
  if (h1s.length <= 1) return 0;
  let demoted = 0;
  h1s.slice(1).each((i, el) => {
    const $el = $(el);
    // Demote to h2, keeping inner HTML; annotate
    const html = $el.html();
    const h2 = $(`<h2 data-seo-demoted="h1"></h2>`).html(html);
    $el.replaceWith(h2);
    demoted++;
  });
  return demoted;
}

function ensureSingleTitle($) {
  const titles = $('head > title');
  if (titles.length <= 1) return 0;
  let removed = 0;
  titles.slice(1).each((_, el) => { $(el).remove(); removed++; });
  return removed;
}

function ensureSingleCanonical($, computedCanonical) {
  const links = $('link[rel="canonical"]');
  if (links.length <= 1) {
    // If one exists but empty and we computed a value, fill it.
    if (links.length === 1 && computedCanonical && !links.attr("href")) {
      links.attr("href", computedCanonical);
      return { normalized: true, replacedHref: true };
    }
    return null;
  }
  // Keep the first non-empty href; else keep first and inject computed
  let primary = null;
  links.each((i, el) => {
    const href = ($(el).attr("href") || "").trim();
    if (!primary && href) primary = el;
  });
  if (!primary) primary = links.get(0);
  let removed = 0;
  links.each((i, el) => { if (el !== primary) { $(el).remove(); removed++; } });
  // If primary has no href and we computed one, set it
  if (computedCanonical) {
    const $p = $(primary);
    const cur = ($p.attr("href") || "").trim();
    if (!cur) $p.attr("href", computedCanonical);
  }
  return { normalized: true, removed };
}

function tuneOne(filePath, src) {
  const $ = cheerio.load(src, { decodeEntities: false });
  const before = $.html();
  // Title
  const $title = $("head > title");
  let title = $title.first().text().trim();
  let changed = false;
  // strict: ensure only one <title> first (avoids flip-flop diffs)
  if (STRICT) {
    const removed = ensureSingleTitle($);
    if (removed > 0) { changed = true; }
  }
  if (title) {
    const trimmed = safeTrimTitle(title);
    if (trimmed !== title) {
      $title.first().text(trimmed);
      title = trimmed; changed = true;
    }
  }
  // Description
  const prevDesc = $('meta[name="description"]').attr("content")?.trim() || "";
  const desc = deriveDescription($);
  if (!prevDesc && desc) {
    $('head').append(`<meta name="description" content="${desc}">`);
    changed = true;
  }
  // Canonical
  const prevCanonical = $('link[rel="canonical"]').attr("href") || "";
  const canonical = ensureCanonical($, filePath);
  if (!prevCanonical && canonical) {
    $('head').append(`<link rel="canonical" href="${canonical}">`);
    changed = true;
  }
  // strict: collapse to exactly one canonical & normalize empty href
  let canonicalNormalize = null;
  if (STRICT) {
    canonicalNormalize = ensureSingleCanonical($, canonical || prevCanonical);
    if (canonicalNormalize?.normalized) changed = true;
  }
  // OG
  const finalTitle = $("head > title").first().text().trim();
  const finalDesc  = $('meta[name="description"]').attr("content")?.trim() || desc;
  const beforeOg = $('meta[property="og:title"]').attr("content") || "" + "|" + ($('meta[property="og:description"]').attr("content") || "");
  ensureOg($, finalTitle, finalDesc);
  let after = $.html();
  if (after !== before) changed = true;

  // produce summary of what changed
  const changes = [];
  if (title && title !== safeTrimTitle(title)) changes.push("title-trimmed"); // should not happen; kept for completeness
  if (!prevDesc && finalDesc) changes.push("description-added");
  if (!prevCanonical && canonical) changes.push("canonical-added");
  const afterOg = $('meta[property="og:title"]').attr("content") || "" + "|" + ($('meta[property="og:description"]').attr("content") || "");
  if (beforeOg !== afterOg) changes.push("og-updated");

  // STRICT extras (opt-in)
  if (STRICT) {
    // og:type
    if (ensureOgType($)) { changed = true; changes.push("og:type-updated"); }
    // og:url
    const ogUrlChanged = ensureOgUrl($, filePath, canonical || prevCanonical);
    if (ogUrlChanged) { changed = true; changes.push("og:url-updated"); }
    // twitter:card
    const tcChanged = ensureTwitterCard($);
    if (tcChanged) { changed = true; changes.push("twitter:card-updated"); }
    // twitter parity
    if (ensureTwitterParity($, finalTitle, finalDesc)) { changed = true; changes.push("twitter:parity"); }
    // dedupe meta
    const dups = dedupeMeta($);
    if (dups) { changed = true; changes.push("meta-deduped"); }
    // single h1
    const demoted = enforceOneH1($);
    if (demoted > 0) { changed = true; changes.push(`h1-demoted:${demoted}`); }
    after = $.html();
  }

  return { changed, out: after, changes };
}

// ---------- main ----------
(async function main() {
  // 1) Gather file list
  let files = [];
  for (const g of GLOBS) {
    const hits = await glob(g, { nodir: true });
    files.push(...hits);
  }
  files = Array.from(new Set(files)).filter(f => f.toLowerCase().endsWith(".html"));

  // 1a) .seo-tuneignore support (glob-like, one pattern per line; # for comments)
  let ignorePatterns = [];
  if (fs.existsSync(IGNORE_FILE)) {
    const raw = fs.readFileSync(IGNORE_FILE, "utf-8")
      .split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
    ignorePatterns = raw;
    if (ignorePatterns.length) {
      const ignored = new Set();
      for (const pat of ignorePatterns) {
        const hits = await glob(pat, { nodir: true });
        hits.forEach(h => ignored.add(h));
      }
      files = files.filter(f => !ignored.has(f));
    }
  }

  // 1b) --only-changed: intersect with files changed since <base>...HEAD
  if (ONLY_CHANGED) {
    const normalize = (p) => p.replaceAll("\\", "/");
    let baseRef = CHANGED_BASE;
    let changed = [];
    try {
      // Make sure refs are available
      try { execSync(`git fetch origin --quiet`, { stdio: "ignore" }); } catch {}
      const out = execSync(`git diff --name-only ${baseRef}...HEAD`, { stdio: ["ignore", "pipe", "pipe"] })
        .toString()
        .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      changed = out.map(normalize);
    } catch (e) {
      // Fallback to repo default branch if origin/main doesn't exist
      try {
        const { data: repoMeta } = await octo.request('GET /repos/{owner}/{repo}', { owner: OWNER, repo: REPO });
        baseRef = `origin/${repoMeta.default_branch}`;
        const out = execSync(`git diff --name-only ${baseRef}...HEAD`, { stdio: ["ignore", "pipe", "pipe"] })
          .toString()
          .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        changed = out.map(normalize);
      } catch {}
    }
    if (changed.length) {
      const changedSet = new Set(changed);
      files = files.filter(f => changedSet.has(normalize(f)));
      console.log(`[seo.tune] --only-changed active; ${files.length} HTML files intersect with changes from ${baseRef}...HEAD`);
    } else {
      console.log(`[seo.tune] --only-changed active; no matching changed HTML files since ${baseRef}...HEAD`);
      // fall through; empty 'files' list will naturally produce a no-changes path
      files = [];
    }
  }

  if (ONLY.length) {
    const onlySet = new Set(ONLY);
    files = files.filter(f => onlySet.has(f) || onlySet.has(path.basename(f)));
  }
  files.sort();

  // 2) Compute proposed edits
  const edits = [];
  for (const file of files) {
    const src = readFileSync(file, "utf-8");
    const { changed, out, changes } = tuneOne(file, src);
    if (changed) {
      edits.push({
        file, hash_before: sha256(src), hash_after: sha256(out), changes,
        preview: {
          title: cheerio.load(out)("head > title").first().text().trim(),
          has_desc: !!cheerio.load(out)('meta[name="description"]').attr("content"),
          has_canonical: !!cheerio.load(out)('link[rel="canonical"]').attr("href")
        },
        out
      });
    }
  }

  // 3) Dry run → JSON summary
  if (DRY) {
    console.log(JSON.stringify({
      dry_run: true,
      strict: STRICT,
      only_changed: ONLY_CHANGED,
      changed_base: ONLY_CHANGED ? CHANGED_BASE : undefined,
      changed_files: edits.length,
      files: edits.map(e => ({ file: e.file, changes: e.changes }))
    }, null, 2));
    return;
  }

  // 4) If nothing to change → optionally ensure a rolling PR when --require-pr
  if (!edits.length) {
    if (!REQUIRE_PR) {
      log("No safe SEO changes detected; exiting.");
      return;
    }
    // Ensure/find/open the rolling PR (draft + needs-approval), update body with No Changes status.
    const { data: repoMeta } = await octo.request('GET /repos/{owner}/{repo}', { owner: OWNER, repo: REPO });
    const base = EXPLICIT_BASE || repoMeta.default_branch;
    const stableBranch = "chore/seo-tune";
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
          pr = (await octo.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner: OWNER, repo: REPO, pull_number: closedStable.number, state: 'open'
          })).data;
          log(`Reopened rolling SEO PR: ${pr.html_url}`);
        } else {
          // Create an empty branch + draft PR to serve as the rolling gate
          execSync(`git fetch origin ${base} --quiet || true`, { stdio: 'ignore' });
          try { execSync(`git checkout -b ${stableBranch}`, { stdio: 'ignore' }); }
          catch { execSync(`git checkout ${stableBranch}`, { stdio: 'ignore' }); }
          // Push branch even if no changes
          try { execSync(`git push -u origin ${stableBranch}`, { stdio: 'inherit' }); }
          catch { execSync(`git push origin ${stableBranch}`, { stdio: 'inherit' }); }
          pr = (await octo.request('POST /repos/{owner}/{repo}/pulls', {
            owner: OWNER, repo: REPO,
            title: `SEO tune (rolling)`,
            head: stableBranch,
            base,
            draft: true,
            body: "Rolling SEO tune PR (no changes yet)."
          })).data;
          if (PR_LABELS.length) {
            try { await octo.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
              owner: OWNER, repo: REPO, issue_number: pr.number, labels: PR_LABELS
            }); } catch {}
          }
        }
      }
      // Update status block: no changes
      const stamp = new Date().toISOString().replace('T',' ').replace('Z',' UTC');
      const status = [
        "<!-- seo-tune:status:start -->",
        "### SEO Tune Status",
        `- **When:** ${stamp}`,
        `- **Changed:** no`,
        `- **Mode:** ${STRICT ? "strict" : "safe"}`,
        "<!-- seo-tune:status:end -->"
      ].join("\n");
      const body = pr.body || "";
      const newBody = /<!-- seo-tune:status:start -->[\s\S]*<!-- seo-tune:status:end -->/m.test(body)
        ? body.replace(/<!-- seo-tune:status:start -->[\s\S]*<!-- seo-tune:status:end -->/m, status)
        : (body ? body + "\n\n---\n\n" : "") + status;
      if (newBody !== body) {
        await octo.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
          owner: OWNER, repo: REPO, pull_number: pr.number, body: newBody
        });
        log("Updated rolling SEO PR status (no changes).");
      }
      console.log(`outputs_uri=${pr.html_url}`);
    } catch (e) {
      err("Failed to ensure rolling PR:", e.status || e.message || e);
    }
    return;
  }

  // 5) Write edits
  for (const e of edits) {
    writeFileSync(e.file, e.out, "utf-8");
  }

  // 6) Git/PR plumbing
  const { data: repoMeta } = await octo.request('GET /repos/{owner}/{repo}', { owner: OWNER, repo: REPO });
  const base = EXPLICIT_BASE || repoMeta.default_branch;
  const branchName = EXPLICIT_BRANCH || `chore/seo-tune-${new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,12)}`;

  // stage & commit
  for (const e of edits) execSync(`git add "${e.file}"`);
  const diffExit = (() => { try { execSync('git diff --cached --quiet'); return 0; } catch { return 1; } })();
  if (diffExit === 0) { log("No staged changes; exiting."); return; }

  execSync(`git fetch origin ${base} --quiet || true`, { stdio: 'ignore' });
  try { execSync(`git checkout -b ${branchName}`, { stdio: 'ignore' }); }
  catch { execSync(`git checkout ${branchName}`, { stdio: 'ignore' }); }
  execSync(`git commit -m "chore(seo): safe meta autofix (auto)"`, { stdio: 'inherit' });
  try { execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' }); }
  catch { execSync(`git push origin ${branchName}`, { stdio: 'inherit' }); }

  // Open a DRAFT PR (approval gate), labeled and assigned
  const bodyTop = [
    "Automated SEO tune (safe meta fixes):",
    "- Title trimmed to ≤70 chars (if needed)",
    "- Added meta description when missing",
    "- Added canonical (if SITE_BASE_URL provided)",
    "- Ensured OG title/description parity",
    STRICT ? "- **STRICT**: og:type, og:url, twitter:card, twitter parity, meta de-dup, single <title>, single <h1>, single canonical" : "",
    "",
    "#### Changed files (summary)",
    ...edits.slice(0, 30).map(e => `- \`${e.file}\` · ${e.changes.join(", ") || "updated"}`),
    edits.length > 30 ? `- …and ${edits.length - 30} more` : ""
  ].join("\n");

  const { data: pr } = await octo.request('POST /repos/{owner}/{repo}/pulls', {
    owner: OWNER, repo: REPO,
    title: `SEO tune (safe autofix): ${new Date().toISOString().slice(0,10)}`,
    head: branchName,
    base,
    draft: PR_DRAFT,
    body: bodyTop
  });

  // Labels / assignees (best-effort)
  if (PR_LABELS.length) {
    try {
      await octo.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
        owner: OWNER, repo: REPO, issue_number: pr.number, labels: PR_LABELS
      });
    } catch {}
  }
  if (PR_ASSIGNEES.length) {
    try {
      await octo.request('POST /repos/{owner}/{repo}/issues/{issue_number}/assignees', {
        owner: OWNER, repo: REPO, issue_number: pr.number, assignees: PR_ASSIGNEES
      });
    } catch {}
  }

  // Machine-readable output for CI
  console.log(`outputs_uri=${pr.html_url}`);
  log(`Opened PR: ${pr.html_url}`);
})().catch(e => { err(e?.stack || e?.message || String(e)); process.exit(1); });
