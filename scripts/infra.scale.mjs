#!/usr/bin/env node
/**
 * infra.scale CLI - Wire "infra.scale" to k8s-planner
 *
 * Dry-run by default. Artifacts: .artifacts/infra-scale/<ts>/plan.yaml and SUMMARY.md
 *
 * Usage:
 *   node scripts/infra.scale.mjs --dry-run \
 *     --target=prod --namespace=assistant \
 *     --workload=Deployment:web:6 \
 *     --hpa=min:4,max:12,cpu:65 \
 *     --req=web:cpu=500m,mem=1Gi --lim=web:cpu=1,mem=2Gi
 *
 * Non-dry-run will open/update a PR with the generated files (and optional manifest changes):
 *   npm run infra:scale
 *
 * Contract lines for CI: prints `outputs_uri=<PR-URL>` and a final status line.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Octokit } from "octokit";
import { makePlan } from "./planners/k8s-planner.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARTIFACTS_ROOT = path.join(ROOT, ".artifacts", "infra-scale");

/**
 * Check if a flag is present in argv
 */
function flag(name) {
  return process.argv.includes(name);
}

/**
 * Get value for a --key=value argument
 */
function val(name, def = null) {
  const idx = process.argv.findIndex(a => a.startsWith(name + "="));
  if (idx === -1) return def;
  return process.argv[idx].split("=", 2)[1];
}

const DRY = flag("--dry-run") || !flag("--apply");
const TARGET = val("--target", "prod");
const NAMESPACE = val("--namespace", "default");
const AUTOSCALING = val("--autoscaling", "hpa"); // default to hpa
const DETECT = val("--detect", "on"); // on|off → off disables kubectl detection
const OWNER = process.env.GH_OWNER || val("--owner", "");
const REPO = process.env.GH_REPO || val("--repo", "");
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const BRANCH = val("--branch", `infra/scale-${Date.now()}`);

/**
 * Parse workload specifications from command line arguments
 * @returns {Array} Array of workload objects
 */
function parseWorkloads() {
  // --workload=Deployment:web:6  (kind:name:replicas)
  // multiple allowed
  const wargs = process.argv
    .filter(a => a.startsWith("--workload="))
    .map(a => a.slice(11));

  const reqs = process.argv
    .filter(a => a.startsWith("--req="))
    .map(a => a.slice(6)); // web:cpu=500m,mem=1Gi

  const lims = process.argv
    .filter(a => a.startsWith("--lim="))
    .map(a => a.slice(6)); // web:cpu=1,mem=2Gi

  const hpaStr = val("--hpa", ""); // min:4,max:12,cpu:65 → applied to all workloads

  // Parse requests map
  const reqMap = new Map();
  for (const r of reqs) {
    const [name, kvs] = r.split(":", 2);
    const o = {};
    kvs.split(",").forEach(p => {
      const [k, v] = p.split("=");
      o[k] = v;
    });
    reqMap.set(name, o);
  }

  // Parse limits map
  const limMap = new Map();
  for (const r of lims) {
    const [name, kvs] = r.split(":", 2);
    const o = {};
    kvs.split(",").forEach(p => {
      const [k, v] = p.split("=");
      o[k] = v;
    });
    limMap.set(name, o);
  }

  // Parse HPA settings
  let hpa = null;
  if (hpaStr) {
    const tmp = {};
    hpaStr.split(",").forEach(p => {
      const [k, v] = p.split(":");
      if (k === "min") tmp.min = Number(v);
      if (k === "max") tmp.max = Number(v);
      if (k === "cpu") tmp.targetCPU = Number(v);
    });
    hpa = tmp;
  }

  // Build workloads array
  const workloads = [];
  for (const w of wargs) {
    // Deployment:web:6
    const [kind, name, rep] = w.split(":");
    const replicas = rep != null ? Number(rep) : undefined;
    workloads.push({
      kind,
      name,
      replicas,
      requests: reqMap.get(name) || null,
      limits: limMap.get(name) || null,
      hpa
    });
  }

  return workloads;
}

/**
 * Write plan artifacts (YAML + SUMMARY.md) to .artifacts/ directory
 * @param {Object} plan - The scale plan object
 * @returns {Object} Paths to generated artifacts
 */
async function writeArtifacts(plan) {
  const ts = new Date().toISOString().replaceAll(":", "-");
  const outDir = path.join(ARTIFACTS_ROOT, ts);
  fs.mkdirSync(outDir, { recursive: true });

  // YAML
  const yaml = toYAML(plan);
  fs.writeFileSync(path.join(outDir, "plan.yaml"), yaml, "utf8");

  // Summary
  const summary = toSummary(plan);
  fs.writeFileSync(path.join(outDir, "SUMMARY.md"), summary, "utf8");

  return {
    outDir,
    yamlPath: path.join(outDir, "plan.yaml"),
    summaryPath: path.join(outDir, "SUMMARY.md")
  };
}

/**
 * Convert object to YAML string (simple dumper, no anchors/aliases)
 * @param {Object} obj - Object to convert
 * @returns {string} YAML string
 */
function toYAML(obj) {
  const jsyaml = (o, indent = 0) => {
    const pad = "  ".repeat(indent);
    if (o === null) return "null";
    if (Array.isArray(o)) {
      return o
        .map(i => `${pad}- ${jsyaml(i, indent + 1).replace(/^\s+/, "")}`)
        .join("\n");
    }
    if (typeof o === "object") {
      return Object.entries(o)
        .map(([k, v]) => {
          const vv = (v && typeof v === "object")
            ? `\n${jsyaml(v, indent + 1)}`
            : `${v ?? ""}`;
          return `${pad}${k}: ${vv}`;
        })
        .join("\n");
    }
    return String(o);
  };
  return jsyaml(obj) + "\n";
}

/**
 * Generate markdown summary from plan
 * @param {Object} plan - The scale plan object
 * @returns {string} Markdown summary
 */
function toSummary(plan) {
  const header = `# Infra Scale Plan (${plan.metadata.target})
- Context: \`${plan.context.kubeContext || "unknown"}\`
- Namespace: \`${plan.context.namespace}\`
- Autoscaling: \`${plan.assumptions.autoscaling}\`
- Actions: **${plan.actions.length}**
`;

  const actions = plan.actions
    .map((a, i) => {
      if (a.action === "scale_workload") {
        return `${i + 1}. **Scale** ${a.kind}/${a.name} → replicas: ${a.to} (from ${a.from ?? "unknown"})`;
      }
      if (a.action === "update_resources") {
        const req = a.requests ? `req ${JSON.stringify(a.requests)}` : "";
        const lim = a.limits ? `lim ${JSON.stringify(a.limits)}` : "";
        return `${i + 1}. **Resources** ${a.kind}/${a.name} ${[req, lim].filter(Boolean).join(" ")}`;
      }
      if (a.action === "apply_hpa") {
        const h = a.hpa || {};
        const f = a.from || {};
        return `${i + 1}. **HPA** ${a.name} (min:${h.min} from:${f.min ?? "?"} · max:${h.max} from:${f.max ?? "?"} · cpu:${h.targetCPU}% from:${f.targetCPU ?? "?"}%)`;
      }
      return `${i + 1}. ${a.action} ${a.kind}/${a.name}`;
    })
    .join("\n");

  const risks = (plan.risks || []).length
    ? `\n## Risks\n${plan.risks.map(r => `- ${r}`).join("\n")}\n`
    : "";

  const hints = (plan.rollbackHints || []).length
    ? `\n## Rollback hints\n${plan.rollbackHints.map(r => `- ${r}`).join("\n")}\n`
    : "";

  const notes = (plan.notes || []).length
    ? `\n## Notes\n${plan.notes.map(n => `- ${n}`).join("\n")}\n`
    : "";

  return `${header}\n## Actions\n${actions}\n${risks}${hints}${notes}`;
}

/**
 * Open or update a GitHub PR with plan artifacts
 * @param {Object} params - PR parameters (title, body, files)
 * @returns {string | null} PR URL or null if GitHub not configured
 */
async function openPR({ title, body, files }) {
  if (!OWNER || !REPO || !TOKEN) return null;
  const octo = new Octokit({ auth: TOKEN });

  // Get base branch
  const { data: repoData } = await octo.request("GET /repos/{owner}/{repo}", {
    owner: OWNER,
    repo: REPO
  });
  const baseRef = repoData.default_branch;

  const { data: latestCommit } = await octo.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
    owner: OWNER,
    repo: REPO,
    ref: `heads/${baseRef}`
  });
  const baseSha = latestCommit.object.sha;

  // Create branch (or update it)
  try {
    await octo.request("POST /repos/{owner}/{repo}/git/refs", {
      owner: OWNER,
      repo: REPO,
      ref: `refs/heads/${BRANCH}`,
      sha: baseSha
    });
  } catch {
    /* branch exists */
  }

  // Build a tree with our files
  const treeItems = [];
  for (const [repoPath, content] of Object.entries(files)) {
    treeItems.push({
      path: repoPath,
      mode: "100644",
      type: "blob",
      content
    });
  }

  const { data: tree } = await octo.request("POST /repos/{owner}/{repo}/git/trees", {
    owner: OWNER,
    repo: REPO,
    base_tree: baseSha,
    tree: treeItems
  });

  const { data: commit } = await octo.request("POST /repos/{owner}/{repo}/git/commits", {
    owner: OWNER,
    repo: REPO,
    message: title,
    tree: tree.sha,
    parents: [baseSha]
  });

  await octo.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
    owner: OWNER,
    repo: REPO,
    ref: `heads/${BRANCH}`,
    sha: commit.sha,
    force: true
  });

  // Create or reuse PR
  const { data: existing } = await octo.request("GET /repos/{owner}/{repo}/pulls", {
    owner: OWNER,
    repo: REPO,
    head: `${OWNER}:${BRANCH}`,
    state: "open",
    per_page: 1
  });

  let pr;
  if (existing.length) {
    pr = existing[0];
    // Update body comment
    await octo.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
      owner: OWNER,
      repo: REPO,
      issue_number: pr.number,
      body
    });
  } else {
    const created = await octo.request("POST /repos/{owner}/{repo}/pulls", {
      owner: OWNER,
      repo: REPO,
      title,
      head: BRANCH,
      base: baseRef,
      body,
      draft: true
    });
    pr = created.data;

    // Label for gate
    await octo.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
      owner: OWNER,
      repo: REPO,
      issue_number: pr.number,
      labels: ["needs-approval"]
    });

    // Post checklist comment for new PRs
    try {
      await postPRChecklist(octo, pr.number);
    } catch { /* non-fatal */ }
  }

  return pr.html_url;
}

/**
 * Build actions table for PR body
 * @param {Object} plan - Scale plan
 * @returns {string} Markdown table
 */
export function buildActionsTable(plan) {
  const ns = plan?.context?.namespace || "default";
  const rows = (plan.actions || []).map(a => {
    const kind = String(a.kind || "").replace(/^HorizontalPodAutoscaler$/i, "HPA");
    if (a.action === "scale_workload") {
      const from = a.from ?? "unknown";
      const detail = (from !== "unknown") ? `replicas **${from} → ${a.to}**` : `replicas → **${a.to}**`;
      return `| Scale | ${kind}/${a.name} (ns: \`${ns}\`) | ${detail} |`;
    }
    if (a.action === "update_resources") {
      const req = a.requests ? "`" + Object.entries(a.requests).map(([k,v])=>`${k}=${v}`).join(",") + "`" : "—";
      const lim = a.limits ? "`" + Object.entries(a.limits).map(([k,v])=>`${k}=${v}`).join(",") + "`" : "—";
      return `| Resources | ${kind}/${a.name} (ns: \`${ns}\`) | req ${req} · lim ${lim} |`;
    }
    if (a.action === "apply_hpa") {
      const h = a.hpa || {};
      const f = a.from || {};
      const min = h.min ?? "?";
      const max = h.max ?? "?";
      const cpu = h.targetCPU ?? "?";
      const diff = [
        f.min !== undefined ? `min **${f.min} → ${min}**` : `min **${min}**`,
        f.max !== undefined ? `max **${f.max} → ${max}**` : `max **${max}**`,
        f.targetCPU !== undefined ? `cpu **${f.targetCPU}% → ${cpu}%**` : `cpu **${cpu}%**`,
      ].join(" · ");
      return `| HPA | ${a.name} (ns: \`${ns}\`) | ${diff} |`;
    }
    return `| ${a.action} | ${kind}/${a.name} (ns: \`${ns}\`) | — |`;
  });
  if (!rows.length) return "_No actions in this plan._";
  return [
    "| Action | Target | Details |",
    "|:--|:--|:--|",
    ...rows.slice(0, 30) // keep table concise
  ].join("\n");
}

/**
 * Build PR body with plan summary
 * @param {Object} params - Parameters
 * @param {Object} params.plan - Scale plan
 * @param {boolean} params.artifactPaths - Whether to include artifact paths
 * @returns {string} PR body markdown
 */
export function buildPRBody({ plan, artifactPaths }) {
  const table = buildActionsTable(plan);
  const artifactsList = artifactPaths
    ? [
        "- `ops/plans/infra-scale/plan.yaml` (in this PR)",
        "- `ops/plans/infra-scale/SUMMARY.md` (in this PR)"
      ].join("\n")
    : "- Plan & Summary artifacts are attached to this PR.";
  const target = plan?.metadata?.target || "unknown";
  const ns = plan?.context?.namespace || "default";
  const autoscaling = plan?.assumptions?.autoscaling || "none";
  return [
    `## Infra Scale Plan — **${target}**`,
    "",
    `- Namespace: \`${ns}\``,
    `- Autoscaling: \`${autoscaling}\``,
    "",
    "### Artifacts",
    artifactsList,
    "",
    "### Actions (summary)",
    table,
    "",
    "> Add label **`execute-plan`** to apply; **`rollback-plan`** to preview rollback."
  ].join("\n");
}

/**
 * Post interactive checklist comment to PR
 * @param {Octokit} octo - Octokit instance
 * @param {number} issueNumber - PR number
 */
async function postPRChecklist(octo, issueNumber) {
  const body = [
    "## ✅ Infra Scale Plan – Review Checklist",
    "",
    "- [ ] Review `plan.yaml` and `SUMMARY.md`",
    "- [ ] Confirm namespace and workloads",
    "- [ ] Capacity & budget LGTM",
    "",
    "### Quick actions",
    "- To **apply** this plan, comment: `**/approve-plan**` (adds label `execute-plan`)",
    "- To **prepare rollback**, comment: `**/rollback-plan**` (adds label `rollback-plan`)",
    "",
    "> Both actions are label-gated by CI. Remove labels to stop jobs. 🚦"
  ].join("\n");
  await octo.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
    owner: OWNER, repo: REPO, issue_number: issueNumber, body
  });
}

/**
 * Main execution function
 */
(async function main() {
  if (DETECT === "off") {
    process.env.SKIP_CLUSTER_DETECT = "1";
  }
  const workloads = parseWorkloads();
  if (!workloads.length) {
    console.error("No workloads specified. Use --workload=Deployment:web:6 etc.");
    process.exit(2);
  }

  const plan = makePlan({
    target: TARGET,
    namespace: NAMESPACE,
    autoscaling: AUTOSCALING,
    workloads
  });

  const { outDir, yamlPath, summaryPath } = await writeArtifacts(plan);

  // For non-dry-run, also stage the plan into repo (e.g., ops/plans/)
  if (!DRY && OWNER && REPO && TOKEN) {
    const yaml = fs.readFileSync(yamlPath, "utf8");
    const summary = fs.readFileSync(summaryPath, "utf8");
    const repoFiles = {
      [`ops/plans/infra-scale/${TARGET}/plan.yaml`]: yaml,
      [`ops/plans/infra-scale/${TARGET}/SUMMARY.md`]: summary
    };

    const body = buildPRBody({ plan, artifactPaths: true });
    const prUrl = await openPR({
      title: `infra.scale: ${TARGET} (${new Date().toISOString().slice(0, 10)})`,
      body,
      files: repoFiles
    });

    console.log(`outputs_uri=${prUrl || ""}`);
    console.log("awaiting_approval");
    return;
  }

  // Dry-run info
  console.log(`artifacts_dir=${outDir}`);
  console.log(`plan_yaml=${yamlPath}`);
  console.log(`summary_md=${summaryPath}`);
  console.log("succeeded");
})().catch(e => {
  console.error(e?.stack || e?.message || String(e));
  console.log("failed");
  process.exit(1);
});
