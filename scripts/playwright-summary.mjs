#!/usr/bin/env node
/**
 * Parse Playwright JSON reporter output -> compact stats + optional Markdown.
 * Usage:
 *   node scripts/playwright-summary.mjs --in reports/playwright.json --out reports/playwright.md
 *   node scripts/playwright-summary.mjs --in reports/playwright.json --json > reports/playwright-summary.json
 */
import fs from "node:fs/promises";

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  if (!a.includes("=")) return [a.replace(/^--/, ""), true];
  const [k, ...rest] = a.split("=");
  return [k.replace(/^--/, ""), rest.join("=")];
}));

if (!args.in || typeof args.in !== "string") {
  console.error("Missing --in <path-to-playwright.json>");
  process.exit(2);
}

const raw = await fs.readFile(args.in, "utf8");
const data = JSON.parse(raw);

// Robust recursive walker (handles nested suites/specs/tests)
function walkSuite(s, agg) {
  if (!s) return;
  for (const spec of s.specs ?? []) {
    for (const t of spec.tests ?? []) {
      agg.total++;
      const ok = t.results?.some(r => r.status === "passed");
      const failed = t.results?.some(r => r.status === "failed");
      const flaky = t.results?.some(r => r.status === "flaky");
      const skipped = t.results?.every(r => r.status === "skipped");
      if (ok) agg.passed++;
      if (failed) agg.failed++;
      if (flaky) agg.flaky++;
      if (skipped) agg.skipped++;
      const dur = t.results?.reduce((a, r) => a + (r.duration ?? 0), 0) ?? 0;
      agg.durationMs += dur;
    }
  }
  for (const child of s.suites ?? []) walkSuite(child, agg);
}

const agg = { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, durationMs: 0 };
for (const s of data.suites ?? []) walkSuite(s, agg);

// Derive percentage + chip text
const pct = agg.total ? Math.round((agg.passed / agg.total) * 100) : 100;
const durSec = Math.round(agg.durationMs / 1000);

const summary = {
  total: agg.total,
  passed: agg.passed,
  failed: agg.failed,
  skipped: agg.skipped,
  flaky: agg.flaky,
  duration_sec: durSec,
  pass_pct: pct,
};

// Output JSON or Markdown
if (args.json) {
  process.stdout.write(JSON.stringify(summary, null, 2));
} else {
  const chip = (txt, emoji) => `\`${emoji} ${txt}\``;
  const md = [
    "### Playwright Summary",
    [
      chip(`${pct}% pass`, pct === 100 ? "🟢" : pct >= 80 ? "🟡" : "🔴"),
      chip(`${summary.passed} passed`, "✅"),
      chip(`${summary.failed} failed`, summary.failed ? "❌" : "✅"),
      chip(`${summary.skipped} skipped`, "⏭️"),
      summary.flaky ? chip(`${summary.flaky} flaky`, "🌶️") : null,
      chip(`${summary.duration_sec}s`, "⏱️"),
    ].filter(Boolean).join("  "),
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Total tests | ${summary.total} |`,
    `| Passed | ${summary.passed} |`,
    `| Failed | ${summary.failed} |`,
    `| Skipped | ${summary.skipped} |`,
    `| Flaky | ${summary.flaky} |`,
    `| Duration (s) | ${summary.duration_sec} |`,
    "",
  ].join("\n");
  if (args.out && typeof args.out === "string") await fs.writeFile(args.out, md, "utf8");
  else process.stdout.write(md);
}
