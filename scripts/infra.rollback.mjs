#!/usr/bin/env node
// Roll back an infra scale plan (safe & gated).
// Usage:
//   node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --dry-run
//   node scripts/infra.rollback.mjs --plan=... --execute --pr=123
// Gate: when --execute + PR number are provided, PR must have label 'rollback-plan'.

import fs from "node:fs";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { Octokit } from "octokit";

function arg(k, d=null){ const a=process.argv.find(x=>x.startsWith(k+"=")); return a? a.split("=",2)[1] : d; }
function flag(k){ return process.argv.includes(k); }

const PLAN_PATH = arg("--plan", null);
const DRY = flag("--dry-run") || !flag("--execute");
const KUBECTL = process.env.KUBECTL || "kubectl";
const OWNER = process.env.GH_OWNER || arg("--owner", "");
const REPO  = process.env.GH_REPO  || arg("--repo", "");
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const PRNUM = arg("--pr", null);

function sh(cmd, args){ 
  if (DRY){ console.log(`preview: ${[cmd,...args].join(" ")}`); return {status:0}; }
  const r = spawnSync(cmd, args, { encoding:"utf8" });
  if (r.status !== 0) throw new Error((r.stderr||r.stdout||"command failed").trim());
  return r;
}

function parsePlan(p){
  const txt = fs.readFileSync(p, "utf8");
  try { return JSON.parse(txt); } catch {}
  // naive YAML section extractor for fields we emit
  const plan = { context:{}, actions:[], rollbackHints:[], assumptions:{} };
  const lines = txt.split(/\r?\n/);
  let section = null;
  let current = null;
  for (const raw of lines){
    const line = raw.replace(/\t/g, "  ");
    if (/^context:/.test(line)) { section="ctx"; continue; }
    if (/^actions:/.test(line)) { section="act"; continue; }
    if (/^rollbackHints:/.test(line)) { section="hint"; continue; }
    if (/^[A-Za-z]/.test(line)) { section=null; current=null; }
    if (section==="ctx"){
      const m=line.match(/^\s+([A-Za-z]+):\s*(.*)$/); if (m) plan.context[m[1]] = m[2];
    } else if (section==="act"){
      if (/^\s-\s/.test(line)){ current={}; plan.actions.push(current); continue; }
      const m=line.match(/^\s+([A-Za-z]+):\s*(.*)$/); if (m && current) current[m[1]]=m[2];
      // nested hpa (rough)
      if (/^\s+hpa:/.test(line)) current._inHPA=true;
      const mh=line.match(/^\s+([A-Za-z]+):\s*(.*)$/);
      if (current && current._inHPA && mh){ (current.hpa||(current.hpa={}))[mh[1]]=mh[2]; }
      if (/^\s+[A-Za-z]+:/.test(line) && !/^\s+hpa:/.test(line)) current._inHPA=false;
    } else if (section==="hint"){
      const m = line.match(/^\s-\s(.*)$/); if (m) plan.rollbackHints.push(m[1]);
    }
  }
  return plan;
}

async function hasRollbackLabel(){
  if (!PRNUM || !OWNER || !REPO || !TOKEN) return false;
  const octo = new Octokit({ auth: TOKEN });
  const { data: labels } = await octo.request(
    "GET /repos/{owner}/{repo}/issues/{issue_number}/labels",
    { owner: OWNER, repo: REPO, issue_number: Number(PRNUM) }
  );
  return (labels||[]).some(l => String(l.name||"").toLowerCase() === "rollback-plan");
}

function applyHint(hint, ns){
  // If the hint looks like a file path -> kubectl apply -f
  if (/\.ya?ml(\.tmpl)?$/i.test(hint) || /^(\.|\/)/.test(hint)){
    sh(KUBECTL, ["-n", ns, "apply", "-f", hint]);
    return `applied ${hint}`;
  }
  // If it's a plain command suggestion, echo it for humans
  console.log(`note: manual hint: ${hint}`);
  return `hint:${hint}`;
}

function rollbackAction(a, ns){
  const kind = String(a.kind||"").toLowerCase();
  const name = a.name;
  switch (a.action){
    case "scale_workload":
    case "update_resources":
      // best/fast rollback: rollout undo deployment/name
      sh(KUBECTL, ["-n", ns, "rollout", "undo", `${kind}/${name}`]);
      return `rolled back ${kind}/${name}`;
    case "apply_hpa":
      // try file from hint first; if none, delete HPA (will fallback to previous behavior)
      return `handled hpa ${name}`; // actual delete handled after hints
    default:
      console.log(`note: skipping unknown action "${a.action}"`);
      return `skipped ${a.action}`;
  }
}

(async function main(){
  if (!PLAN_PATH || !fs.existsSync(PLAN_PATH)){
    console.error("Plan not found. Use --plan=...");
    console.log("failed"); process.exit(2);
  }
  if (!DRY){
    if (PRNUM && !(await hasRollbackLabel())){
      console.error("Refusing to execute: PR missing label 'rollback-plan'.");
      console.log("skipped"); process.exit(0);
    }
  }

  const plan = parsePlan(PLAN_PATH);
  const ns = plan?.context?.namespace || "default";
  const results = [];

  // 1) Use hints first (apply known previous manifests)
  let usedHpaHint = false;
  for (const h of plan.rollbackHints || []){
    const r = applyHint(h, ns);
    results.push({ ok:true, type:"hint", note:r });
    if (/hpa/i.test(h) && /\.ya?ml/i.test(h)) usedHpaHint = true;
  }

  // 2) Roll back actions (deployments/resources)
  for (const a of plan.actions || []){
    try {
      if (a.action === "apply_hpa") continue; // defer HPA to after hints
      const r = rollbackAction(a, ns);
      results.push({ ok:true, type:"action", action:a.action, note:r });
    } catch (e){
      results.push({ ok:false, type:"action", action:a.action, error:String(e.message||e) });
      if (!DRY){ console.log("failed"); throw e; }
    }
  }

  // 3) HPA fallback: if plan applied HPA but no concrete hint was used, try deleting HPA
  const hadHpa = (plan.actions||[]).some(a => a.action === "apply_hpa");
  if (hadHpa && !usedHpaHint){
    const names = [...new Set(plan.actions.filter(a=>a.action==="apply_hpa").map(a=>a.name))];
    for (const name of names){
      try {
        sh(KUBECTL, ["-n", ns, "delete", "hpa", name]);
        results.push({ ok:true, type:"hpa", note:`deleted hpa/${name}` });
      } catch (e){
        results.push({ ok:false, type:"hpa", error:String(e.message||e) });
        if (!DRY){ console.log("failed"); throw e; }
      }
    }
  }

  console.log(JSON.stringify({ ok:true, executed: !DRY, namespace: ns, results }, null, 2));
  console.log("succeeded");
})().catch(e => { console.error(e?.stack || e?.message || String(e)); console.log("failed"); process.exit(1); });
