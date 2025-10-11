#!/usr/bin/env node
/**
 * Minimal code review stub - emits diff-aware JSON payload.
 * Replace with real ESLint/TypeScript integration when ready.
 */
import os from "node:os";
import { execSync } from "node:child_process";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const outFmt = arg("out", "json");
const diff = arg("diff", "HEAD~1..HEAD");

let changed = [];
try {
  const raw = execSync(`git diff --name-only ${diff}`, {
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf-8"
  });
  changed = raw.split(/\r?\n/).filter(Boolean);
} catch {
  // Not a git repo or diff failed - that's fine, continue with empty list
}

// Generate findings for changed files (stub: all pass)
const findings = changed.slice(0, 25).map(f => ({
  file: f,
  severity: "info",
  message: "Stub review: no issues found",
  rule: "stub/no-op"
}));

const payload = {
  tool: "code-review-stub",
  diff,
  hostname: os.hostname(),
  files_examined: changed.length,
  findings,
  summary: {
    errors: 0,
    warnings: 0,
    infos: findings.length
  }
};

if (outFmt === "json") {
  process.stdout.write(JSON.stringify(payload));
} else {
  console.log("Use --out json");
  process.exit(2);
}
