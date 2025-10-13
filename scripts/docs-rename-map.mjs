#!/usr/bin/env node
/**
 * Auto-populate renameMap from git mv history
 * Scans git log for file renames and updates docs.config.json
 *
 * Usage:
 *   node scripts/docs-rename-map.mjs
 *   npm run docs:renames
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const cfgPath = "docs/docs.config.json";

try {
  // Get rename history from git log
  const out = execSync('git log --name-status --diff-filter=R --pretty=""', { encoding: "utf8" });
  const map = {};

  out.split("\n").forEach(line => {
    // Format: R100\told\tnew (or similar)
    if (!line.startsWith("R")) return;
    const parts = line.split("\t");
    if (parts.length < 3) return;

    const oldPath = parts[1];
    const newPath = parts[2];

    // Only track doc file renames
    if (oldPath && newPath && (oldPath.endsWith(".md") || newPath.endsWith(".md"))) {
      map[oldPath] = newPath;
    }
  });

  // Load existing config
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

  // Merge with existing renameMap (new entries take precedence)
  cfg.renameMap = Object.assign({}, cfg.renameMap || {}, map);

  // Write back
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");

  console.log("✅ Updated renameMap with", Object.keys(map).length, "rename entries from git history");
  if (Object.keys(map).length > 0) {
    console.log("\nRecent renames:");
    Object.entries(map).slice(0, 10).forEach(([old, newP]) => {
      console.log(`  ${old} → ${newP}`);
    });
    if (Object.keys(map).length > 10) {
      console.log(`  ... and ${Object.keys(map).length - 10} more`);
    }
  }
} catch (err) {
  console.error("❌ Error updating renameMap:", err.message);
  process.exit(1);
}
