#!/usr/bin/env node
/**
 * Lightweight LH batch runner stub.
 * Emits a single JSON object (or array) to stdout.
 * Replace with your real Lighthouse pipeline when ready.
 */
import fs from "node:fs";
import path from "node:path";

function arg(name, fallback = null) {
  const ix = process.argv.findIndex(a => a === `--${name}`);
  if (ix >= 0 && process.argv[ix + 1]) return process.argv[ix + 1];
  return fallback;
}

const format = arg("format", "json");
const sitemap = arg("sitemap", "sitemap.xml");
const pagesArg = arg("pages", null); // optional explicit list

function readSitemap(file) {
  try {
    const xml = fs.readFileSync(file, "utf8");
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]).slice(0, 10); // cap for stub
    return urls;
  } catch {
    return [];
  }
}

const pages = pagesArg ? pagesArg.split(",").map(s => s.trim()) : readSitemap(sitemap);

// Fake results shaped a bit like LH so our backend summary can extract scores.
const report = {
  generatedAt: new Date().toISOString(),
  pages: pages.length,
  categories: {
    performance: { score: 0.92 },
    accessibility: { score: 0.98 },
    "best-practices": { score: 0.95 },
    seo: { score: 0.99 }
  },
  entries: pages.map(u => ({ url: u, ok: true }))
};

if (format === "json") {
  process.stdout.write(JSON.stringify(report));
} else {
  console.log("Unsupported format. Use --format json");
  process.exit(2);
}
