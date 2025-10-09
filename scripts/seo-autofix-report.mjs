#!/usr/bin/env node
/**
 * Read seo-autofix JSON (stdout or file) and print a concise Markdown summary.
 * Usage:
 *   node scripts/seo-autofix-report.mjs --in reports/seo-autofix.json > reports/seo-autofix.md
 *   # or pipe stdin:
 *   node scripts/seo-autofix-report.mjs < reports/seo-autofix.json > reports/seo-autofix.md
 */
import fs from "node:fs/promises";

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    if (!a.includes("=")) return [a.replace(/^--/, ""), true];
    const [k, ...rest] = a.split("=");
    return [k.replace(/^--/, ""), rest.join("=")];
  })
);

async function readInput() {
  if (args.in && typeof args.in === "string") return fs.readFile(args.in, "utf8");
  // read from stdin
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

const raw = await readInput();
let j;
try { j = JSON.parse(raw); } catch (e) {
  console.error("Failed to parse JSON input:", e.message);
  process.exit(2);
}

const { base, changed = 0, wrote = 0, files = [] } = j;

const needing = files.filter(f => f.changed);
const wroteFiles = files.filter(f => f.wrote);

const header = `### SEO Autofix (dry-run) summary
- **Base**: ${base || "(n/a)"}
- **Files scanned**: ${j.scanned ?? files.length}
- **Files needing fixes**: ${changed}
- **Files written**: ${wrote} (should be 0 in dry-run)
`;

let list = "";
if (needing.length) {
  list += `\n**Needing fixes:**\n`;
  for (const f of needing) {
    const note = f.note ? ` — _${f.note}_` : "";
    list += `- \`${f.fp}\`${note}\n`;
  }
} else {
  list += `\n✅ No changes needed.`;
}

const wroteList = wroteFiles.length
  ? `\n\n**Files actually written (apply mode):**\n` +
    wroteFiles.map(f => `- \`${f.fp}\``).join("\n")
  : "";

process.stdout.write(`${header}${list}${wroteList}\n`);
