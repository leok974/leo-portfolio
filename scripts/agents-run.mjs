#!/usr/bin/env node
// Minimal agent runner: node scripts/agents-run.mjs --agent seo --task validate --payload payload.json
import fs from "node:fs";
import path from "node:path";

function arg(flag, def = undefined) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : def;
}

const agent = arg("--agent");
const task = arg("--task");
const payloadArg = arg("--payload");          // file path or inline JSON
const base = process.env.AGENT_API_BASE || process.env.PUBLIC_API_ORIGIN || "http://127.0.0.1:8001";
const token = arg("--token") || process.env.AGENT_TOKEN || ""; // e.g., "dev" in dev mode

if (!agent || !task) {
  console.error("Usage: node scripts/agents-run.mjs --agent <name> --task <name> [--payload <file|json>] [--token <token>]");
  process.exit(2);
}

let payload = {};
if (payloadArg) {
  try {
    if (fs.existsSync(payloadArg)) {
      const p = path.resolve(payloadArg);
      payload = JSON.parse(fs.readFileSync(p, "utf8"));
    } else {
      payload = JSON.parse(payloadArg);
    }
  } catch (e) {
    console.error("Failed to parse --payload:", e.message);
    process.exit(2);
  }
}

const body = { agent, task, payload };

const url = `${base.replace(/\/+$/,"")}/agent/run`; // keep matching your existing public run route
const headers = {
  "Content-Type": "application/json",
};
if (token) headers["Authorization"] = `Bearer ${token}`;

const start = Date.now();
const abort = new AbortController();
const timeoutMs = Number(process.env.AGENT_TIMEOUT_MS ?? 120000);
const t = setTimeout(() => abort.abort(), timeoutMs);

globalThis.fetch = (await import("node-fetch")).default;

try {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: abort.signal,
  });
  clearTimeout(t);

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  const ms = Date.now() - start;
  const ok = res.ok && (data.ok ?? true);

  // Compact summary for CI logs
  const summary = {
    ok,
    status: res.status,
    duration_ms: ms,
    agent,
    task,
    result: data?.result ?? data?.totals ?? undefined,
    errors: data?.errors ?? data?.error ?? undefined,
    _url: url
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
} catch (err) {
  clearTimeout(t);
  console.error(JSON.stringify({ ok:false, error: String(err), agent, task, _url: url }, null, 2));
  process.exit(1);
}
