#!/usr/bin/env node
/**
 * Sitemap Media Manifest Validator
 *
 * Validates public/sitemap.media.json for:
 * - Required fields (images: loc, videos: thumbnail_loc/title/description)
 * - Asset existence under dist/
 * - URL formats
 * - Date formats
 *
 * Usage:
 *   node scripts/validate-sitemap-media.mjs
 *   node scripts/validate-sitemap-media.mjs --strict  (exit 1 on errors)
 *   DIST_DIR=dist node scripts/validate-sitemap-media.mjs
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const DIST = process.env.DIST_DIR || 'dist';
const MANIFEST = 'public/sitemap.media.json';
const GALLERY = 'public/gallery.json';

const issues = [];
const warn = (msg) => issues.push({ level: 'warn', msg });
const err  = (msg) => issues.push({ level: 'error', msg });

function readJSON(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { err(`Invalid JSON in ${path}: ${e.message}`); return null; }
}

function must(path, fields, obj, ctx) {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || obj[f] === '') {
      err(`${ctx}: missing required field "${f}" (${path})`);
    }
  }
}

// Ensure referenced asset exists under dist/
function checkAsset(relPath, ctx) {
  if (!relPath || typeof relPath !== 'string') return;
  if (!relPath.startsWith('/')) {
    warn(`${ctx}: asset path should start with "/": "${relPath}"`);
    return;
  }
  const disk = join(DIST, relPath.slice(1));
  if (!existsSync(disk)) {
    err(`${ctx}: asset not found in ${DIST}: "${relPath}" -> ${disk}`);
    return;
  }
  try {
    const st = statSync(disk);
    if (st.size === 0) warn(`${ctx}: asset is empty: "${relPath}"`);
  } catch (e) {
    err(`${ctx}: failed to stat asset "${relPath}": ${e.message}`);
  }
}

function run() {
  // Build a combined media map = sitemap.media.json ⊕ gallery.json→/gallery.html
  const manifest = readJSON(MANIFEST) || {};
  const gallery = readJSON(GALLERY) || {};
  const galleryItems = Array.isArray(gallery.items) ? gallery.items : [];
  const galleryMedia = {};
  if (galleryItems.length) {
    const images = [];
    const videos = [];
    for (const it of galleryItems) {
      const isAbs = (s) => typeof s === 'string' && s.startsWith('/');
      if (it.type === 'image' && isAbs(it.src)) {
        images.push({ loc: it.src, caption: it.description || it.title || undefined, title: it.title || undefined });
      } else if (it.type === 'video-local' && isAbs(it.src)) {
        if (isAbs(it.poster)) {
          videos.push({
            thumbnail_loc: it.poster,
            title: it.title || 'Video',
            description: it.description || 'Video',
            content_loc: it.src
          });
        } else {
          warn(`gallery video-local "${it.title || it.src}": missing poster (thumbnail_loc) — will be skipped in video sitemap`);
        }
      } else if ((it.type === 'youtube' || it.type === 'vimeo') && typeof it.src === 'string') {
        if (isAbs(it.poster)) {
          videos.push({
            thumbnail_loc: it.poster,
            title: it.title || 'Video',
            description: it.description || 'Video',
            player_loc: it.src
          });
        } else {
          warn(`gallery ${it.type} "${it.title || it.src}": missing poster (thumbnail_loc) — will be skipped in video sitemap`);
        }
      }
    }
    if (images.length || videos.length) {
      galleryMedia['/gallery.html'] = { images, videos };
    }
  }
  const media = {};
  // Deep-merge manifest + galleryMedia
  for (const src of [manifest, galleryMedia]) {
    for (const [page, val] of Object.entries(src)) {
      media[page] = {
        images: [...(media[page]?.images || []), ...(val.images || [])],
        videos: [...(media[page]?.videos || []), ...(val.videos || [])],
      };
    }
  }
  if (!Object.keys(media).length) {
    console.log(`[media-lint] No ${MANIFEST} or ${GALLERY} media found — nothing to validate.`);
    return { ok: true };
  }

  const pages = Object.keys(media);
  if (pages.length === 0) warn(`Manifest has no page entries.`);

  for (const page of pages) {
    const entry = media[page] || {};
    const ctxBase = `page "${page}"`;

    // Images
    const imgs = Array.isArray(entry.images) ? entry.images : [];
    imgs.forEach((img, idx) => {
      const ctx = `${ctxBase} image[${idx}]`;
      must('images', ['loc'], img, ctx);
      checkAsset(img.loc, `${ctx} loc`);
      if (img.license && !/^https?:\/\//.test(img.license)) {
        warn(`${ctx}: license should be a URL (got "${img.license}")`);
      }
    });

    // Videos
    const vids = Array.isArray(entry.videos) ? entry.videos : [];
    vids.forEach((v, idx) => {
      const ctx = `${ctxBase} video[${idx}]`;
      must('videos', ['thumbnail_loc','title','description'], v, ctx);
      if (!v.content_loc && !v.player_loc) {
        err(`${ctx}: need at least one of "content_loc" or "player_loc"`);
      }
      checkAsset(v.thumbnail_loc, `${ctx} thumbnail_loc`);
      if (v.content_loc && /^https?:\/\//.test(v.content_loc)) {
        // external video file is fine; skip dist check
      } else {
        checkAsset(v.content_loc, `${ctx} content_loc`);
      }
      if (v.player_loc && !/^https?:\/\//.test(v.player_loc)) {
        warn(`${ctx}: player_loc should be absolute URL (got "${v.player_loc}")`);
      }
      if (v.duration && (!Number.isInteger(v.duration) || v.duration <= 0)) {
        warn(`${ctx}: duration should be a positive integer (seconds)`);
      }
      if (v.publication_date && isNaN(Date.parse(v.publication_date))) {
        warn(`${ctx}: invalid publication_date "${v.publication_date}" (YYYY-MM-DD)`);
      }
    });
  }

  // Report
  const warnings = issues.filter(i => i.level === 'warn');
  const errors   = issues.filter(i => i.level === 'error');
  for (const i of issues) {
    const prefix = i.level === 'error' ? '[media-lint:ERROR]' : '[media-lint:WARN] ';
    console.log(`${prefix} ${i.msg}`);
  }

  console.log(`[media-lint] ${errors.length} error(s), ${warnings.length} warning(s). DIST="${DIST}" MANIFEST="${MANIFEST}" GALLERY="${GALLERY}"`);
  const ok = errors.length === 0;
  if (!ok && STRICT) process.exit(1);
  return { ok };
}

run();
