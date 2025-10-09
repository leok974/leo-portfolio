#!/usr/bin/env node
/**
 * Safe, conservative SEO autofixes.
 * Usage:
 *   node scripts/seo-autofix.mjs --base=https://yoursite.tld [--apply] [--dry-run]
 *
 * Behavior:
 *  - Ensures meta description, canonical, OG, Twitter card on HTML entrypoints.
 *  - Adds alt text for <img> without alt (derived from filename).
 *  - Idempotent, only writes when needed.
 */

import fs from "node:fs/promises";
import path from "node:path";

// Optional dependency: cheerio (tiny, robust HTML parser)
import * as cheerio from "cheerio";

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.split("=");
    return [k.replace(/^--/, ""), v ?? true];
  })
);

const BASE = (args.base ?? process.env.BASE_URL ?? "").replace(/\/+$/, "");
const APPLY = !!args.apply || String(process.env.AUTO_FIX).toLowerCase() === "true";
const DRY = !!args["dry-run"];

if (!BASE) {
  console.error("ERROR: --base (or BASE_URL env) is required.");
  process.exit(2);
}

// Discover likely HTML entrypoints
const candidateFiles = [
  "index.html",
  "public/index.html",
  "apps/web/index.html",
  "apps/web/public/index.html",
];

async function exists(p) {
  try { await fs.stat(p); return true; } catch { return false; }
}

// Recursively find additional HTML files under common roots (but not node_modules/dist)
const EXTRA_ROOTS = ["public", "apps/web/public", "src/pages", "apps/web/src/pages"];
async function findHtmlFiles() {
  const out = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (/node_modules|dist|build|coverage|playwright-report/i.test(p)) continue;
        await walk(p);
      } else if (e.isFile() && /\.html?$/i.test(e.name)) {
        out.push(p);
      }
    }
  }
  for (const r of EXTRA_ROOTS) await walk(r);
  return out;
}

function ensureMeta($, name, content) {
  let el = $(`meta[name="${name}"]`);
  if (el.length === 0) {
    $("head").append(`<meta name="${name}" content="${content}">`);
    return true;
  } else {
    const curr = el.attr("content") ?? "";
    if (!curr.trim()) { el.attr("content", content); return true; }
  }
  return false;
}

function ensureMetaProp($, property, content) {
  let el = $(`meta[property="${property}"]`);
  if (el.length === 0) {
    $("head").append(`<meta property="${property}" content="${content}">`);
    return true;
  } else {
    const curr = el.attr("content") ?? "";
    if (!curr.trim()) { el.attr("content", content); return true; }
  }
  return false;
}

function ensureLinkRel($, rel, href) {
  let el = $(`link[rel="${rel}"]`);
  if (el.length === 0) {
    $("head").append(`<link rel="${rel}" href="${href}">`);
    return true;
  } else {
    const curr = el.attr("href") ?? "";
    if (!curr.trim()) { el.attr("href", href); return true; }
  }
  return false;
}

function humanizeFileName(fn = "") {
  const base = path.basename(fn).replace(/\.[a-z0-9]+$/i, "");
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
    || "Image";
}

function deriveTitle($) {
  const t = $("title").first().text().trim();
  return t || "Website";
}

function deriveDescription($) {
  // Prefer existing content; else produce a neutral fallback
  const existing = $(`meta[name="description"]`).attr("content")?.trim();
  if (existing) return existing;
  const h1 = $("h1").first().text().trim();
  if (h1) return `${h1} — overview and key links.`;
  return "Overview, key pages, and links.";
}

function ensureTwitterCard($) {
  return ensureMeta($, "twitter:card", "summary_large_image");
}

function ensureOgSet($, url, imageUrl) {
  let changed = false;
  changed |= ensureMetaProp($, "og:type", "website");
  changed |= ensureMetaProp($, "og:url", url);
  changed |= ensureMetaProp($, "og:title", deriveTitle($));
  changed |= ensureMetaProp($, "og:description", deriveDescription($));
  changed |= ensureMetaProp($, "og:image", imageUrl);
  return changed;
}

function ensureCanonical($, url) {
  return ensureLinkRel($, "canonical", url);
}

function fixMissingAlt($) {
  let changed = false;
  $("img").each((_, img) => {
    const $img = $(img);
    if (!$img.attr("alt")) {
      const src = $img.attr("src") || "";
      $img.attr("alt", humanizeFileName(src));
      changed = true;
    }
  });
  return changed;
}

function isLikelyFrameworkShell($) {
  // Heuristics: root <div id="root">, script type=module entry, etc.
  const hasRoot = $("#root, #__next, #app").length > 0;
  const hasModuleScript = $('script[type="module"]').length > 0;
  return hasRoot && hasModuleScript;
}

async function processFile(fp) {
  const html = await fs.readFile(fp, "utf8");
  const $ = cheerio.load(html);

  const url = BASE || "";
  // Only set OG image if we have a real image file (honor DEV_GUARD in dev)
  const devGuardEnabled = String(process.env.DEV_GUARD_ENABLED).toLowerCase() === "true";
  const allowPlaceholder = String(process.env.DEV_ALLOW_PLACEHOLDER_OG).toLowerCase() === "true";

  // In CI/production or when guards disabled: use actual OG image path
  // In dev with guards: skip OG image unless placeholder allowed
  let ogImage = `${BASE}/og/site-default.jpg`;
  if (devGuardEnabled && !allowPlaceholder) {
    // Check if real image exists (simplified: assume it exists if not in dev mode)
    // For now, we'll skip setting OG image in guarded dev mode
    ogImage = null;
  }

  let changed = false;

  // If it's a framework shell, we still ensure global fallbacks in <head>.
  changed |= ensureCanonical($, url);
  changed |= ensureMeta($, "description", deriveDescription($));
  changed |= ensureTwitterCard($);
  if (ogImage) {
    changed |= ensureOgSet($, url, ogImage);
  }
  changed |= fixMissingAlt($);

  if (!changed) return { fp, changed: false };

  if (DRY || !APPLY) {
    return { fp, changed: true, wrote: false, note: "dry-run" };
  }
  await fs.writeFile(fp, $.html(), "utf8");
  return { fp, changed: true, wrote: true };
}

(async () => {
  // Build candidate list
  const found = (await Promise.all(candidateFiles.map(async f => (await exists(f)) ? f : null)))
    .filter(Boolean);
  const more = await findHtmlFiles();

  // Deduplicate, prefer top-level entrypoints first
  const files = Array.from(new Set([...found, ...more]));

  if (files.length === 0) {
    console.log("No HTML files found to process. Skipping.");
    process.exit(0);
  }

  const results = [];
  for (const fp of files) {
    try {
      const r = await processFile(fp);
      if (r) results.push(r);
    } catch (e) {
      console.warn(`Warn: failed to process ${fp}: ${e.message}`);
    }
  }

  const changed = results.filter(r => r.changed);
  const wrote = results.filter(r => r.wrote);
  console.log(JSON.stringify({
    base: BASE,
    apply: APPLY,
    dry_run: DRY,
    scanned: files.length,
    changed: changed.length,
    wrote: wrote.length,
    files: results
  }, null, 2));

  // Exit non-zero if something changed in dry-run (useful for local checks)
  if (!APPLY && DRY && changed.length > 0) process.exit(3);
})();
