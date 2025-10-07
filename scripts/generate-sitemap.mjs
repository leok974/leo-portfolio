#!/usr/bin/env node
/**
 * Sitemap & robots.txt Generator (Enhanced with Media + Gzip)
 *
 * Generates:
 * - sitemap.xml (+ sitemap.xml.gz)
 * - sitemap-images.xml
 * - sitemap-videos.xml
 * - sitemap-index.xml
 * - robots.txt
 *
 * Usage:
 *   SITE_URL="https://leok.dev" node scripts/generate-sitemap.mjs
 */

import { writeFileSync, mkdirSync, statSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

function iso(file) {
  try { return new Date(statSync(file).mtimeMs).toISOString(); }
  catch { return new Date().toISOString(); }
}

function discoverPages(distDir) {
  return readdirSync(distDir)
    .filter(f => extname(f) === '.html' && !f.startsWith('_') && !f.includes('.draft'))
    .map(f => `/${f === 'index.html' ? '' : f}`);
}

const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';
const distDir = 'dist';
const pages = discoverPages(distDir);

const urlMeta = {
  '/': { priority: 0.9, changefreq: 'weekly' },
  '/book.html': { priority: 0.8, changefreq: 'monthly' },
  '/privacy.html': { priority: 0.6, changefreq: 'yearly' },
};

// Optional media manifest at public/sitemap.media.json
function readMedia() {
  const p = 'public/sitemap.media.json';
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch { return {}; }
}

// Optional gallery auto-ingest at public/gallery.json → merged into /gallery.html images/videos
function readGallery() {
  const p = 'public/gallery.json';
  if (!existsSync(p)) return {};
  let data;
  try { data = JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
  const items = Array.isArray(data.items) ? data.items : [];
  const images = [];
  const videos = [];
  for (const it of items) {
    // Normalize: only accept absolute (site-root) paths for local assets
    const isAbs = (s) => typeof s === 'string' && s.startsWith('/');
    if (it.type === 'image' && isAbs(it.src)) {
      images.push({
        loc: it.src,
        caption: it.description || it.title || undefined,
        title: it.title || undefined
      });
    } else if (it.type === 'video-local' && isAbs(it.src)) {
      // For video sitemap, thumbnail_loc is strongly recommended; include only if present
      if (isAbs(it.poster)) {
        videos.push({
          thumbnail_loc: it.poster,
          title: it.title || 'Video',
          description: it.description || 'Video',
          content_loc: it.src
        });
      }
    } else if ((it.type === 'youtube' || it.type === 'vimeo') && typeof it.src === 'string') {
      // Require a poster for video sitemap entry
      if (isAbs(it.poster)) {
        videos.push({
          thumbnail_loc: it.poster,
          title: it.title || 'Video',
          description: it.description || 'Video',
          player_loc: it.src
        });
      }
    }
  }
  if (!images.length && !videos.length) return {};
  return { '/gallery.html': { images, videos } };
}

function mergeMedia(base, ext) {
  const out = { ...base };
  for (const [page, val] of Object.entries(ext || {})) {
    const cur = out[page] || {};
    const images = [...(cur.images || []), ...(val.images || [])];
    const videos = [...(cur.videos || []), ...(val.videos || [])];

    // De-duplicate by unique key (loc for images, content_loc/player_loc for videos)
    const uniq = (arr, key) => {
      const seen = new Set();
      return arr.filter(x => {
        const k = key(x);
        if (!k) return true;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };

    out[page] = {
      images: uniq(images, x => x.loc),
      videos: uniq(videos, x => x.content_loc || x.player_loc),
    };
  }
  return out;
}

const media = mergeMedia(readMedia(), readGallery());

function xmlEscape(s) {
  return String(s).replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}

const urls = pages.map(p => ({
  loc: p,
  ...urlMeta[p],
  lastmod: iso(join(distDir, p === '/' ? 'index.html' : p.slice(1))),
  images: (media[p]?.images || []).map(img => ({
    loc: img.loc,
    caption: img.caption,
    title: img.title,
    geo_location: img.geo_location,
    license: img.license,
  })),
  videos: (media[p]?.videos || []).map(v => ({
    thumbnail_loc: v.thumbnail_loc,
    title: v.title,
    description: v.description,
    content_loc: v.content_loc,
    player_loc: v.player_loc,
    duration: v.duration,
    publication_date: v.publication_date,
    family_friendly: v.family_friendly,
    tag: v.tag,
  })),
}));

const sitemap =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls.map(u => `
  <url>
    <loc>${SITE_URL}${xmlEscape(u.loc)}</loc>
    <priority>${u.priority ?? 0.5}</priority>
    <changefreq>${u.changefreq ?? 'monthly'}</changefreq>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    ${(u.images || []).map(img => `
      <image:image>
        <image:loc>${SITE_URL}${xmlEscape(img.loc)}</image:loc>
        ${img.caption ? `<image:caption>${xmlEscape(img.caption)}</image:caption>` : ''}
        ${img.title ? `<image:title>${xmlEscape(img.title)}</image:title>` : ''}
        ${img.geo_location ? `<image:geo_location>${xmlEscape(img.geo_location)}</image:geo_location>` : ''}
        ${img.license ? `<image:license>${xmlEscape(img.license)}</image:license>` : ''}
      </image:image>`).join('')}
    ${(u.videos || []).map(v => `
      <video:video>
        <video:thumbnail_loc>${SITE_URL}${xmlEscape(v.thumbnail_loc)}</video:thumbnail_loc>
        <video:title>${xmlEscape(v.title || 'Video')}</video:title>
        <video:description>${xmlEscape(v.description || 'Video')}</video:description>
        ${v.content_loc ? `<video:content_loc>${SITE_URL}${xmlEscape(v.content_loc)}</video:content_loc>` : ''}
        ${v.player_loc ? `<video:player_loc>${xmlEscape(v.player_loc)}</video:player_loc>` : ''}
        ${v.duration ? `<video:duration>${v.duration}</video:duration>` : ''}
        ${v.publication_date ? `<video:publication_date>${v.publication_date}</video:publication_date>` : ''}
        ${typeof v.family_friendly === 'boolean' ? `<video:family_friendly>${v.family_friendly ? 'yes' : 'no'}</video:family_friendly>` : ''}
        ${v.tag ? []
          .concat(v.tag)
          .map(t => `<video:tag>${xmlEscape(t)}</video:tag>`)
          .join('') : ''}
      </video:video>`).join('')}
  </url>`).join('\n')}
</urlset>
`;

const sitemapImages =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.filter(u => (u.images||[]).length).map(u => `
  <url>
    <loc>${SITE_URL}${xmlEscape(u.loc)}</loc>
    ${(u.images||[]).map(img => `
      <image:image>
        <image:loc>${SITE_URL}${xmlEscape(img.loc)}</image:loc>
        ${img.caption ? `<image:caption>${xmlEscape(img.caption)}</image:caption>` : ''}
      </image:image>`).join('')}
  </url>`).join('\n')}
</urlset>`;

const sitemapVideos =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls.filter(u => (u.videos||[]).length).map(u => `
  <url>
    <loc>${SITE_URL}${xmlEscape(u.loc)}</loc>
    ${(u.videos||[]).map(v => `
      <video:video>
        <video:thumbnail_loc>${SITE_URL}${xmlEscape(v.thumbnail_loc)}</video:thumbnail_loc>
        <video:title>${xmlEscape(v.title || 'Video')}</video:title>
        <video:description>${xmlEscape(v.description || 'Video')}</video:description>
        ${v.content_loc ? `<video:content_loc>${SITE_URL}${xmlEscape(v.content_loc)}</video:content_loc>` : ''}
      </video:video>`).join('')}
  </url>`).join('\n')}
</urlset>`;

const sitemapIndex =
`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE_URL}/sitemap.xml</loc></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-images.xml</loc></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-videos.xml</loc></sitemap>
</sitemapindex>`;

mkdirSync('public', { recursive: true });
mkdirSync('dist', { recursive: true });

writeFileSync('public/sitemap.xml', sitemap);
writeFileSync('dist/sitemap.xml', sitemap);
writeFileSync('public/sitemap.xml.gz', gzipSync(Buffer.from(sitemap)));
writeFileSync('dist/sitemap.xml.gz', gzipSync(Buffer.from(sitemap)));

writeFileSync('public/sitemap-images.xml', sitemapImages);
writeFileSync('dist/sitemap-images.xml', sitemapImages);
writeFileSync('public/sitemap-videos.xml', sitemapVideos);
writeFileSync('dist/sitemap-videos.xml', sitemapVideos);
writeFileSync('public/sitemap-index.xml', sitemapIndex);
writeFileSync('dist/sitemap-index.xml', sitemapIndex);

const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap-index.xml
`;
writeFileSync('public/robots.txt', robots);
writeFileSync('dist/robots.txt', robots);

console.log('[sitemap] Wrote sitemap.xml (+ .gz), images/videos, index, robots.txt to public/ and dist/');
