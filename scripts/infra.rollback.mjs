#!/usr/bin/env node
// Roll back an infra scale plan (safe & label-gated).
// Usage:
//   node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --dry-run
//   GH_* env + --pr=<num> + --execute → requires PR label `rollback-plan`

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
  // naive YAML subset parser (we only read fields we emit)
  const plan = { context:{}, actions:[], rollbackHints:[], assumptions:{} };
  const lines = txt.split(/\r?\n/);
  let section = null, current = null, inHPA = false;
  for (const raw of lines){
    const line = raw.replace(/\t/g,"  ");
    if (/^context:/.test(line)) { section="ctx"; continue; }
    if (/^actions:/.test(line)) { section="act"; continue; }
    if (/^rollbackHints:/.test(line)) { section="hint"; continue; }
    if (/^[A-Za-z]/.test(line)) { section=null; current=null; inHPA=false; }
    if (section==="ctx"){
      const m=line.match(/^\s+([A-Za-z]+):\s*(.*)$/); if (m) plan.context[m[1]] = m[2];
    } else if (section==="act"){
      if (/^\s-\s/.test(line)){ current={}; plan.actions.push(current); inHPA=false; continue; }
      if (/^\s+hpa:/.test(line)) { inHPA = true; current.hpa = current.hpa || {}; continue; }
      const m=line.match(/^\s+([A-Za-z]+):\s*(.*)$/);
      if (m && current) { (inHPA ? current.hpa : current)[m[1]] = m[2]; }
    } else if (section==="hint"){
      const m=line.match(/^\s-\s(.*)$/); if (m) plan.rollbackHints.push(m[1]);
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

async function postPRComment(summary){
  if (!PRNUM || !OWNER || !REPO || !TOKEN) return;
  const octo = new Octokit({ auth: TOKEN });
  const body = [
    "### 🔄 Rollback executor",
    "",
    "```json",
    JSON.stringify(summary, null, 2),
    "```",
    DRY ? "\n> Mode: **dry-run**" : "\n> Mode: **executed**"
  ].join("\n");
  await octo.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
    owner: OWNER, repo: REPO, issue_number: Number(PRNUM), body
  });
}

function applyHint(hint, ns){
  if (/\.ya?ml(\.tmpl)?$/i.test(hint) || /^(\.|\/)/.test(hint)){
    sh(KUBECTL, ["-n", ns, "apply", "-f", hint]);
    return `applied ${hint}`;
  }
  console.log(`note: manual hint: ${hint}`);
  return `hint:${hint}`;
}

function rollbackAction(a, ns){
  const kind = String(a.kind||"").toLowerCase();
  const name = a.name;
  switch ((a.action||"").trim()){
    case "scale_workload":
    case "update_resources":
      sh(KUBECTL, ["-n", ns, "rollout", "undo", `${kind}/${name}`]);
      return `rolled back ${kind}/${name}`;
    case "apply_hpa":
      return `hpa planned ${name}`; // handled after hints
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

  // 1) apply hints first (prior manifests)
  let usedHpaHint = false;
  for (const h of plan.rollbackHints || []){
    const note = applyHint(h, ns);
    results.push({ ok:true, type:"hint", note });
    if (/hpa/i.test(h) && /\.ya?ml/i.test(h)) usedHpaHint = true;
  }

  // 2) rollout undo for deployments/resources
  for (const a of plan.actions || []){
    if (a.action === "apply_hpa") continue;
    try {
      const note = rollbackAction(a, ns);
      results.push({ ok:true, type:"action", action:a.action, note });
    } catch (e){
      results.push({ ok:false, type:"action", action:a.action, error:String(e.message||e) });
      if (!DRY){ console.log("failed"); throw e; }
    }
  }

  // 3) HPA fallback
  const hadHpa = (plan.actions||[]).some(a => a.action === "apply_hpa");
  if (hadHpa && !usedHpaHint){
    const names = [...new Set(plan.actions.filter(a=>a.action==="apply_hpa").map(a=>a.name))];
    for (const name of names){
      try { sh(KUBECTL, ["-n", ns, "delete", "hpa", name]); results.push({ ok:true, type:"hpa", note:`deleted hpa/${name}` }); }
      catch (e){ results.push({ ok:false, type:"hpa", error:String(e.message||e) }); if (!DRY){ console.log("failed"); throw e; } }
    }
  }

  const summary = { ok:true, executed: !DRY, namespace: ns, results };
  console.log(JSON.stringify(summary, null, 2));
  console.log("succeeded");
  try { await postPRComment(summary); } catch {}
})().catch(e => { console.error(e?.stack || e?.message || String(e)); console.log("failed"); process.exit(1); });
