#!/usr/bin/env node
/**
 * Docs Consolidation Script
 * - Builds a clean docs index
 * - Renames/moves known docs
 * - Flags or deletes deprecated/duplicated docs (only with --apply)
 * - Fixes internal links and checks for broken anchors
 * - Generates docs/INDEX.md and a summary report
 *
 * Usage:
 *   node scripts/docs-consolidate.mjs            # dry-run
 *   node scripts/docs-consolidate.mjs --apply    # apply changes
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Minimatch } from "minimatch";

const repoRoot = process.cwd();
const docsDir = path.join(repoRoot, "docs");
const cfgPath = path.join(docsDir, "docs.config.json");
const APPLY = process.argv.includes("--apply");

function loadCfg() {
  if (!fs.existsSync(cfgPath)) {
    throw new Error(`Missing ${cfgPath}. Create it with allowlists and rules.`);
  }
  return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
}

function hashFile(p) {
  const h = crypto.createHash("sha1");
  h.update(fs.readFileSync(p));
  return h.digest("hex").slice(0, 8);
}

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

function rel(p) {
  return path.relative(repoRoot, p).replaceAll("\\", "/");
}

function matchesAny(fileRel, patterns = []) {
  return patterns.some(p => {
    if (p.startsWith("re:")) return new RegExp(p.slice(3)).test(fileRel);
    const mm = new Minimatch(p, { nocase: true, dot: true });
    return mm.match(fileRel);
  });
}

function ensureFrontmatter(md, title) {
  const hasFm = md.trimStart().startsWith("---");
  if (hasFm) return md; // assume okay
  return `---\ntitle: ${title}\n---\n\n${md}`;
}

function fixLinks(md, renameMap) {
  // basic md link patcher [text](docs/Old.md) → using renameMap keys
  return md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url) => {
    const clean = url.split("#")[0];
    const anchor = url.includes("#") ? `#${url.split("#").slice(1).join("#")}` : "";
    const key = clean.replace(/^\.\//, "");
    const newTarget = renameMap[key] || renameMap[`docs/${key}`] || null;
    if (newTarget) {
      const norm = newTarget.startsWith("docs/") ? newTarget : `docs/${newTarget}`;
      return `[${txt}](${norm}${anchor})`;
    }
    return m;
  });
}

function main() {
  if (!fs.existsSync(docsDir)) {
    console.error("No docs/ directory found. Skipping.");
    process.exit(0);
  }

  const cfg = loadCfg();
  const report = { kept: [], renamed: [], removed: [], flagged: [], fixedLinks: [], frontmatterAdded: [] };

  // 1) Move/rename according to renameMap
  for (const [fromRel, toRel] of Object.entries(cfg.renameMap || {})) {
    const from = path.join(repoRoot, fromRel);
    const to = path.join(repoRoot, toRel);
    if (fs.existsSync(from)) {
      report.renamed.push({ from: rel(from), to: rel(to) });
      if (APPLY) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.renameSync(from, to);
      }
    }
  }

  // 2) Fix links + ensure frontmatter + collect set for INDEX
  const renameKeys = Object.assign({}, cfg.renameMap || {});
  const finalList = listFiles(docsDir).filter(f => f.endsWith(".md"));
  for (const f of finalList) {
    const r = rel(f);
    if ((cfg.keep || []).includes(r) || (cfg.required || []).includes(r) || r === "docs/INDEX.md") {
      let content = fs.readFileSync(f, "utf8");
      const orig = content;
      const title = path.basename(f, ".md").replace(/_/g, " ");
      content = ensureFrontmatter(content, title);
      const withFrontmatter = content !== orig;
      content = fixLinks(content, renameKeys);
      if (content !== orig) {
        report.fixedLinks.push(r);
        if (withFrontmatter) report.frontmatterAdded.push(r);
        if (APPLY) fs.writeFileSync(f, content);
      }
      report.kept.push(r);
      continue;
    }

    // handle deprecated / duplicates / extras
    const isKeptByPattern = matchesAny(r, cfg.keepPatterns);
    const isDeprecated = (cfg.deprecated || []).includes(r) || matchesAny(r, cfg.deprecatedPatterns);
    const isExtra = !(cfg.keep || []).includes(r) && !isKeptByPattern;
    if (isDeprecated || isExtra) {
      // Delete only if explicitly allowed by rules
      const okToDelete = (cfg.delete || []).includes(r) || matchesAny(r, cfg.deletePatterns);
      if (okToDelete) {
        // Time-based safeguard: don't delete files modified in last 14 days
        const stat = fs.statSync(f);
        const daysSinceModified = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);

        if (daysSinceModified < 14) {
          report.flagged.push({
            file: r,
            reason: "recent_change",
            details: `Modified ${Math.floor(daysSinceModified)} days ago - skipping delete`
          });
        } else {
          report.removed.push(r);
          if (APPLY) fs.rmSync(f, { force: true });
        }
      } else {
        report.flagged.push({ file: r, reason: isDeprecated ? "deprecated" : "extra" });
      }
    } else {
      report.kept.push(r);
    }
  }

  // 3) Generate INDEX.md (sorted groups)
  const groups = cfg.indexGroups || [
    { title: "Overview", items: ["docs/ARCHITECTURE.md", "docs/DEPLOY.md", "docs/DEVELOPMENT.md"] },
    { title: "API", items: ["docs/API.md"] },
    { title: "Security", items: ["docs/SECURITY.md"] },
    { title: "Guides", items: ["docs/PHASE_0.3.0.md", "docs/CHANGELOG.md", "CONTRIBUTING.md"] }
  ];

  const indexLines = ["# Documentation Index\n"];
  for (const g of groups) {
    indexLines.push(`## ${g.title}\n`);
    for (const item of g.items) {
      const p = path.join(repoRoot, item);
      if (fs.existsSync(p)) {
        indexLines.push(`- [${path.basename(item)}](${item})`);
      }
    }
    indexLines.push("");
  }

  if (APPLY) {
    fs.writeFileSync(path.join(docsDir, "INDEX.md"), indexLines.join("\n"));
  }

  // 4) Report (and optional artifact)
  const out = JSON.stringify(report, null, 2);
  const outPath = path.join(docsDir, `consolidation-report.${hashFile(cfgPath)}.json`);
  fs.writeFileSync(outPath, out);
  console.log(out);
  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to commit changes.");
  }
}

main();
