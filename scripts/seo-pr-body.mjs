#!/usr/bin/env node
/**
 * SEO PR Body Generator
 *
 * Generates a formatted PR body from the SEO intelligence summary.
 * Part of Phase 50.9 nightly automation.
 */

import fs from "node:fs/promises";

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    if (!a.includes("=")) return [a.replace(/^--/, ""), true];
    const [k, ...rest] = a.split("=");
    return [k.replace(/^--/, ""), rest.join("=")];
  })
);

const path = args.summary ?? "reports/summary.json";
const autofixPath = args.autofix ?? "reports/seo-autofix.json";
const pwPath = args.playwright ?? "reports/playwright.json";

// Helper to check file existence
const exists = async p => {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
};

try {
  const s = JSON.parse(await fs.readFile(path, "utf8"));

  // Load autofix JSON if available
  let autofixData = null;
  if (await exists(autofixPath)) {
    try {
      autofixData = JSON.parse(await fs.readFile(autofixPath, "utf8"));
    } catch (e) {
      console.error("Warning: Could not parse autofix JSON:", e.message);
    }
  }

  // Load Playwright JSON if available and summarize
  let pStats = null;
  if (await exists(pwPath)) {
    try {
      const pjson = JSON.parse(await fs.readFile(pwPath, "utf8"));
      if (pjson?.suites) {
        const agg = { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, durationMs: 0 };
        const walk = s => {
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
              agg.durationMs += (t.results ?? []).reduce((a, r) => a + (r.duration ?? 0), 0);
            }
          }
          for (const c of s.suites ?? []) walk(c);
        };
        for (const suite of pjson.suites) walk(suite);
        const pct = agg.total ? Math.round((agg.passed / agg.total) * 100) : 100;
        pStats = {
          total: agg.total,
          passed: agg.passed,
          failed: agg.failed,
          skipped: agg.skipped,
          flaky: agg.flaky,
          pass_pct: pct,
          duration_sec: Math.round(agg.durationMs / 1000)
        };
      }
    } catch (e) {
      console.error("Warning: Could not parse Playwright JSON:", e.message);
    }
  }

  const lines = [];
  const chip = (text, emoji) => `\`${emoji} ${text}\``;

  // Header with badge chips
  const passRate = ((s.totals.passed / s.totals.total) * 100).toFixed(1);
  const pct = parseFloat(passRate);

  lines.push(`# 🔍 Nightly SEO & Analytics Report`);
  lines.push(``);

  // Badge line
  const badges = [
    chip(`${pct.toFixed(0)}% pass`, pct === 100 ? "🟢" : pct >= 80 ? "🟡" : "🔴"),
    chip(`${s.totals.passed} passed`, "✅"),
    chip(`${s.totals.failed} failed`, s.totals.failed ? "❌" : "✅"),
  ];

  if (pStats) {
    badges.push(chip(`PW ${pStats.pass_pct}%`, pStats.pass_pct === 100 ? "🧪" : "🧪"));
  }

  if (autofixData) {
    const changed = autofixData.changed ?? 0;
    badges.push(chip(`${changed} need fixes`, changed ? "🧩" : "🎉"));
  }

  lines.push(badges.join("  "));
  lines.push(``);
  lines.push(`**Base URL**: ${s.base}  `);
  lines.push(`**Backend URL**: ${s.backend_url}  `);
  lines.push(`**Generated**: ${s.generated_at}`);
  lines.push(``);

  // Summary with emoji indicators
  const emoji = s.totals.failed === 0 ? "✅" : s.totals.failed <= 2 ? "⚠️" : "❌";

  lines.push(`## ${emoji} Summary`);
  lines.push(``);
  lines.push(`- **Passed**: ${s.totals.passed} / ${s.totals.total} (${passRate}%)`);
  lines.push(`- **Failed**: ${s.totals.failed}`);
  lines.push(``);

  // Group checks by category
  const categories = {
    "🌐 Frontend": s.checks.filter(c => c.key.startsWith("home.")),
    "🔌 Backend": s.checks.filter(c => c.key.startsWith("backend.")),
    "🖼️ Assets": s.checks.filter(c => c.key.startsWith("assets.")),
    "🔒 Privacy": s.checks.filter(c => c.key.startsWith("privacy.")),
  };

  lines.push(`## Detailed Results`);
  lines.push(``);

  for (const [category, checks] of Object.entries(categories)) {
    if (checks.length === 0) continue;

    const passed = checks.filter(c => c.ok).length;

    lines.push(`### ${category}`);
    lines.push(``);
    lines.push(`**Status**: ${passed}/${checks.length} passed`);
    lines.push(``);

    for (const c of checks) {
      lines.push(`- ${c.ok ? "✅" : "❌"} \`${c.key}\``);
      lines.push(`  ${c.note}`);
    }
    lines.push(``);
  }

  // Playwright section (if available)
  if (pStats) {
    lines.push(`## 🧪 Playwright Tests`);
    lines.push(``);
    lines.push(`- **Total**: ${pStats.total}`);
    lines.push(`- **Passed**: ${pStats.passed}`);
    lines.push(`- **Failed**: ${pStats.failed}`);
    if (pStats.skipped > 0) lines.push(`- **Skipped**: ${pStats.skipped}`);
    if (pStats.flaky > 0) lines.push(`- **Flaky**: ${pStats.flaky}`);
    lines.push(`- **Duration**: ${pStats.duration_sec}s`);
    lines.push(`- **Pass Rate**: ${pStats.pass_pct}%`);
    lines.push(``);
  }

  // Artifacts section
  lines.push(`## 📦 Artifacts`);
  lines.push(``);
  lines.push(`Download the full report artifacts from the workflow run:`);
  lines.push(`- \`reports/summary.json\` - Machine-readable summary`);
  lines.push(`- \`reports/summary.md\` - Human-readable markdown report`);
  lines.push(``);

  // Action items (if any failures)
  if (s.totals.failed > 0) {
    lines.push(`## 🔧 Action Items`);
    lines.push(``);
    const failedChecks = s.checks.filter(c => !c.ok);
    for (const c of failedChecks) {
      lines.push(`- [ ] Fix \`${c.key}\`: ${c.note}`);
    }
    lines.push(``);
  }

  // Integration notes
  lines.push(`## 🔗 Integration`);
  lines.push(``);
  lines.push(`This automated report is part of **Phase 50.9** nightly monitoring.`);
  lines.push(``);
  lines.push(`- Workflow: \`.github/workflows/seo-intel-nightly.yml\``);
  lines.push(`- Scanner: \`scripts/seo-intel.mjs\``);
  lines.push(`- Schedule: Daily at 02:30 ET (06:30 UTC)`);
  lines.push(``);

  // Changelog stub
  lines.push(`## 📝 Changelog Stub`);
  lines.push(``);
  lines.push(`\`\`\`markdown`);
  lines.push(`### Monitoring`);
  lines.push(`- chore(seo): nightly report & artifacts ($(date +%F))`);
  if (s.totals.failed > 0) {
    lines.push(`- fix(seo): address ${s.totals.failed} SEO/analytics issues`);
  }
  lines.push(`\`\`\``);
  lines.push(``);

  // Footer
  lines.push(`---`);
  lines.push(``);
  lines.push(`🤖 _Automated by GitHub Actions | Phase 50.9 Nightly SEO & Analytics_`);

  // Output to stdout
  process.stdout.write(lines.join("\n"));
} catch (err) {
  console.error("Error generating PR body:", err);
  process.exit(1);
}
