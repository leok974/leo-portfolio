#!/usr/bin/env node
/**
 * Minimal infra scaling stub - pretends to compute a scale plan (dry-run).
 * Replace with real Docker/k8s scaling logic when ready.
 */
import os from "node:os";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const outFmt = arg("out", "json");
const plan = process.argv.includes("--plan");

const payload = {
  tool: "infra-scale-stub",
  mode: plan ? "plan" : "unknown",
  hostname: os.hostname(),
  recommendations: [
    {
      service: "web",
      action: "scale",
      from: 2,
      to: 3,
      reason: "p95 latency > 400ms"
    },
    {
      service: "api",
      action: "hold",
      from: 2,
      to: 2,
      reason: "stable performance"
    }
  ],
  cost_delta_estimate_usd: 27.50
};

if (outFmt === "json") {
  process.stdout.write(JSON.stringify(payload));
} else {
  console.log("Use --out json");
  process.exit(2);
}
