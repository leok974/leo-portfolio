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

function tuneOne(filePath, src) {
  const $ = cheerio.load(src, { decodeEntities: false });
  const before = $.html();
  // Title
  const $title = $("head > title");
  let title = $title.first().text().trim();
  let changed = false;
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
  // OG
  const finalTitle = $("head > title").first().text().trim();
  const finalDesc  = $('meta[name="description"]').attr("content")?.trim() || desc;
  const beforeOg = $('meta[property="og:title"]').attr("content") || "" + "|" + ($('meta[property="og:description"]').attr("content") || "");
  ensureOg($, finalTitle, finalDesc);
  const after = $.html();
  if (after !== before) changed = true;

  // produce summary of what changed
  const changes = [];
  if (title && title !== safeTrimTitle(title)) changes.push("title-trimmed"); // should not happen; kept for completeness
  if (!prevDesc && finalDesc) changes.push("description-added");
  if (!prevCanonical && canonical) changes.push("canonical-added");
  const afterOg = $('meta[property="og:title"]').attr("content") || "" + "|" + ($('meta[property="og:description"]').attr("content") || "");
  if (beforeOg !== afterOg) changes.push("og-updated");

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
      changed_files: edits.length,
      files: edits.map(e => ({ file: e.file, changes: e.changes }))
    }, null, 2));
    return;
  }

  // 4) If nothing to change → fast exit (no PR)
  if (!edits.length) {
    log("No safe SEO changes detected; exiting.");
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
