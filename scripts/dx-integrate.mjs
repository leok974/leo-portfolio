#!/usr/bin/env node
/**
 * Minimal DX integration stub - simulates storybook/docs/lint checks.
 * Replace with real Storybook build check + doc validation when ready.
 */
import os from "node:os";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const outFmt = arg("out", "json");
const check = process.argv.includes("--check");

const payload = {
  tool: "dx-integrate-stub",
  mode: check ? "check" : "unknown",
  hostname: os.hostname(),
  checks: [
    { name: "storybook", status: "ok", message: "Build passed (stub)" },
    { name: "docs", status: "ok", message: "Docs validated (stub)" },
    { name: "lint", status: "ok", message: "Lint passed (stub)" }
  ],
  summary: {
    ok: 3,
    warn: 0,
    fail: 0
  }
};

if (outFmt === "json") {
  process.stdout.write(JSON.stringify(payload));
} else {
  console.log("Use --out json");
  process.exit(2);
}
