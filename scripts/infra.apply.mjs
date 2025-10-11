#!/usr/bin/env node
/**
 * infra.apply.mjs
 *
 * Apply an infra scale plan to Kubernetes, gated & safe.
 *
 * Usage:
 *   node scripts/infra.apply.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --dry-run
 *   KUBECTL=echo node scripts/infra.apply.mjs --plan=... --execute   (preview without real kubectl)
 *   # PR gate (requires label execute-plan):
 *   GH_OWNER=... GH_REPO=... GITHUB_TOKEN=... node scripts/infra.apply.mjs --plan=... --execute --pr=123
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { Octokit } from "octokit";

function arg(k, def=null){ const a=process.argv.find(x=>x.startsWith(k+"=")); return a? a.split("=",2)[1] : def; }
function flag(k){ return process.argv.includes(k); }

const PLAN_PATH = arg("--plan", null) ||
  (arg("--target") ? path.join("ops","plans","infra-scale", arg("--target"), "plan.yaml") : null);

const DRY = flag("--dry-run") || !flag("--execute");
const KUBECTL = process.env.KUBECTL || "kubectl";

const OWNER = process.env.GH_OWNER || arg("--owner", "");
const REPO  = process.env.GH_REPO  || arg("--repo", "");
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const PRNUM = arg("--pr", null);

function loadYamlLike(p){
  // very small YAML subset parser for our plan (we generated it ourselves)
  // For robustness, accept JSON too.
  const txt = fs.readFileSync(p, "utf8").trim();
  if (txt.startsWith("{")) return JSON.parse(txt);
  // super-naive YAML -> JSON via yq fallback? Keep it simple: also write JSON next to YAML when planning if you want full fidelity.
  // Here we parse only fields we emit in planner.
  const lines = txt.split(/\r?\n/);
  const plan = { context:{}, assumptions:{}, actions:[] };
  let ctx = plan;
  let currentAction = null;
  for (const raw of lines) {
    const line = raw.replace(/\t/g,"    ");
    if (/^\s*apiVersion:/.test(line)) continue;
    if (/^\s*kind:/.test(line)) continue;
    const mK = line.match(/^(\s*)([A-Za-z][\w]*):\s*(.*)$/);
    if (!mK) {
      const mList = line.match(/^(\s*)-\s+(.*)$/);
      if (mList && currentAction) {
        // not used
      }
      continue;
    }
    const indent = mK[1].length, key = mK[2], val = mK[3];
    if (indent===0) {
      if (key==="metadata") ctx = plan.metadata = {};
      else if (key==="context") ctx = plan.context = {};
      else if (key==="assumptions") ctx = plan.assumptions = {};
      else if (key==="actions") { plan.actions=[]; ctx = plan; }
      else ctx = plan;
      continue;
    }
    if (key==="actions") { /* handled above */ }
    if (plan.actions===undefined) plan.actions=[];
    if (/^\s*-\s*$/.test(val)) { /* skip */ }
    if (ctx===plan) {
      // creating action items when we enter actions section
    }
    if (raw.trim().startsWith("- ")) {
      currentAction = {};
      plan.actions.push(currentAction);
      const kv = raw.trim().slice(2);
      const m2 = kv.match(/^([A-Za-z][\w]*):\s*(.*)$/);
      if (m2) currentAction[m2[1]] = parseMaybe(m2[2]);
      ctx = currentAction;
      continue;
    }
    if (ctx === plan) { /* ignore */ }
    else if (ctx === plan.context || ctx === plan.assumptions || ctx === plan.metadata) {
      ctx[key] = parseMaybe(val);
    } else if (currentAction) {
      currentAction[key] = parseMaybe(val);
    }
  }
  return plan;
}
function parseMaybe(v){
  if (v === "" || v === null || v === undefined) return "";
  const s = String(v).trim();
  if (s==="null") return null;
  if (s==="true") return true;
  if (s==="false") return false;
  if (/^\d+$/.test(s)) return Number(s);
  return s;
}

async function hasExecutePlanLabel() {
  if (!PRNUM || !OWNER || !REPO || !TOKEN) return false;
  const octo = new Octokit({ auth: TOKEN });
  const { data: labels } = await octo.request(
    "GET /repos/{owner}/{repo}/issues/{issue_number}/labels",
    { owner: OWNER, repo: REPO, issue_number: Number(PRNUM) }
  );
  return (labels||[]).some(l => String(l.name||"").toLowerCase()==="execute-plan");
}

function sh(cmd, args) {
  if (DRY) {
    console.log(`preview: ${[cmd,...args].join(" ")}`);
    return { status: 0, stdout: "", stderr: "" };
  }
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
  return r;
}

function applyAction(action, ns) {
  switch (action.action) {
    case "scale_workload": {
      const kind = action.kind.toLowerCase();
      const name = action.name;
      const replicas = Number(action.to);
      if (!Number.isFinite(replicas)) throw new Error(`invalid replicas for ${kind}/${name}`);
      sh(KUBECTL, ["-n", ns, "scale", `${kind}/${name}`, `--replicas=${replicas}`]);
      return `scaled ${kind}/${name} to ${replicas}`;
    }
    case "update_resources": {
      const kind = action.kind.toLowerCase();
      const name = action.name;
      const req = action.requests || {};
      const lim = action.limits || {};
      const setArgs = ["-n", ns, "set", "resources", `${kind}/${name}`];
      if (Object.keys(req).length) setArgs.push("--requests", pairs(req));
      if (Object.keys(lim).length) setArgs.push("--limits", pairs(lim));
      sh(KUBECTL, setArgs);
      return `resources updated ${kind}/${name}`;
    }
    case "apply_hpa": {
      const name = action.name;
      const h = action.hpa || {};
      const args = ["-n", ns, "autoscale", "deployment", name];
      if (h.min != null) args.push(`--min=${h.min}`);
      if (h.max != null) args.push(`--max=${h.max}`);
      if (h.targetCPU != null) args.push(`--cpu-percent=${h.targetCPU}`);
      sh(KUBECTL, args);
      return `hpa applied ${name} (min:${h.min} max:${h.max} cpu:${h.targetCPU}%)`;
    }
    default:
      console.log(`note: unknown action "${action.action}" skipped`);
      return `skipped ${action.action}`;
  }
}
function pairs(obj){ return Object.entries(obj).map(([k,v])=>`${k}=${v}`).join(","); }

(async function main(){
  if (!PLAN_PATH || !fs.existsSync(PLAN_PATH)) {
    console.error("Plan not found. Use --plan=... or --target=...");
    console.log("failed"); process.exit(2);
  }
  const plan = loadYamlLike(PLAN_PATH);
  const ns = (plan.context && plan.context.namespace) || "default";

  if (!DRY) {
    // Gate: if PR provided, require execute-plan label
    if (PRNUM && !(await hasExecutePlanLabel())) {
      console.error("Refusing to execute: PR missing label 'execute-plan'.");
      console.log("skipped"); process.exit(0);
    }
  }

  const results = [];
  for (const a of (plan.actions || [])) {
    try {
      const r = applyAction(a, ns);
      results.push({ ok: true, action: a.action, note: r });
    } catch (e) {
      results.push({ ok: false, action: a.action, error: String(e.message || e) });
      if (!DRY) { console.log("failed"); throw e; }
    }
  }

  // Summarize to stdout (and allow CI to capture)
  console.log(JSON.stringify({ ok: true, executed: !DRY, namespace: ns, results }, null, 2));
  console.log(DRY ? "succeeded" : "succeeded");
})().catch(e => { console.error(e?.stack || e?.message || String(e)); console.log("failed"); process.exit(1); });
