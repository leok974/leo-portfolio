#!/usr/bin/env node
/**
 * Workflows Consolidation Script
 * - Validates and consolidates .github/workflows/*.yml
 * - Allows only allowlisted workflows, flags or deletes extras
 * - Detects overlapping triggers/jobs and duplicates
 *
 * Usage:
 *   node scripts/workflows-consolidate.mjs            # dry-run
 *   node scripts/workflows-consolidate.mjs --apply    # apply deletions
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

const APPLY = process.argv.includes("--apply");
const repoRoot = process.cwd();
const wfDir = path.join(repoRoot, ".github", "workflows");
const allowlist = new Set([
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  ".github/workflows/docs-audit.yml" // New audit workflow
]);

if (!fs.existsSync(wfDir)) {
  console.log("No .github/workflows directory; skipping.");
  process.exit(0);
}

const files = fs.readdirSync(wfDir).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
const report = { keep: [], remove: [], flagged: [], duplicates: [] };

function rel(p) {
  return p.replaceAll("\\", "/");
}

function triggerKey(doc) {
  const on = doc.on || {};
  if (typeof on === "string") return on;
  return Object.keys(on).sort().join("+");
}

const seen = new Map();

for (const f of files) {
  const full = path.join(wfDir, f);
  const raw = fs.readFileSync(full, "utf8");
  let doc;
  try {
    doc = yaml.parse(raw);
  } catch (e) {
    report.flagged.push({ file: rel(full), reason: `YAML parse error: ${e.message}` });
    continue;
  }

  const trig = triggerKey(doc);
  const jobNames = doc.jobs ? Object.keys(doc.jobs).sort() : [];
  const sig = `${trig}|${jobNames.join(",")}`;

  if (allowlist.has(rel(full))) {
    report.keep.push(rel(full));
  } else {
    // non-allowlisted → either duplicate of allowed or extra
    const dupOf = [...seen.entries()].find(([k]) => k === sig);
    if (dupOf) {
      report.duplicates.push({ file: rel(full), same_as: dupOf[1] });
      report.remove.push(rel(full));
    } else {
      report.flagged.push({ file: rel(full), reason: "Not in allowlist; review" });
    }
  }

  if (!seen.has(sig)) seen.set(sig, rel(full));
}

if (APPLY) {
  for (const f of report.remove) {
    fs.rmSync(path.join(repoRoot, f), { force: true });
  }
}

console.log(JSON.stringify(report, null, 2));
if (!APPLY) console.log("\nDry-run only. Re-run with --apply to delete duplicates.");
