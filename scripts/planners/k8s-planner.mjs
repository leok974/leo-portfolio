/**
 * K8s Planner - Stateless Kubernetes scaling planner
 *
 * A tiny, stateless planner that turns "desired scale" into a YAML plan.
 * It never mutates the cluster. It just computes *what to change*.
 *
 * Input (example):
 * {
 *   target: "prod",
 *   namespace: "assistant",
 *   workloads: [
 *     {
 *       kind: "Deployment",
 *       name: "web",
 *       replicas: 6,
 *       requests: { cpu: "500m", mem: "1Gi" },
 *       limits: { cpu: "1", mem: "2Gi" },
 *       hpa: { min: 4, max: 12, targetCPU: 65 }
 *     }
 *   ],
 *   autoscaling: "hpa" // or "none"
 * }
 *
 * Output: plan object (later dumped as YAML)
 */

import { execSync } from "node:child_process";

/**
 * Detect the current kubectl context
 * @returns {string | null} Current kubectl context or null if not available
 */
export function detectContext() {
  try {
    const ctx = execSync("kubectl config current-context", { encoding: "utf8" }).trim();
    return ctx || null;
  } catch {
    return null;
  }
}

/**
 * Check if cluster detection should run
 * @returns {boolean} False if SKIP_CLUSTER_DETECT=1, true otherwise
 */
function shouldDetect() {
  // SKIP_CLUSTER_DETECT=1 to force off, or detect=off via CLI (infra.scale passes through)
  return String(process.env.SKIP_CLUSTER_DETECT || "").trim() !== "1";
}

/**
 * Detect current replica count from cluster
 * @param {string} kind - Resource kind (Deployment, StatefulSet, etc.)
 * @param {string} name - Resource name
 * @param {string} namespace - Namespace
 * @returns {Object} { ok: boolean, replicas?: number }
 */
export function detectReplicas(kind, name, namespace) {
  if (!shouldDetect()) return { ok: false };
  try {
    const k = kind.toLowerCase();
    const out = execSync(
      `kubectl -n ${namespace} get ${k}/${name} -o json`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const obj = JSON.parse(out);
    // Prefer spec.replicas (desired) with fallback to status.replicas
    const current = obj?.spec?.replicas ?? obj?.status?.replicas;
    if (typeof current === "number") return { ok: true, replicas: current };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

/**
 * Detect current HPA settings from cluster
 * @param {string} name - HPA name
 * @param {string} namespace - Namespace
 * @returns {Object} { ok: boolean, min?: number, max?: number, cpu?: number }
 */
export function detectHPA(name, namespace) {
  if (!shouldDetect()) return { ok: false };
  try {
    const out = execSync(
      `kubectl -n ${namespace} get hpa ${name} -o json`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const h = JSON.parse(out);
    // Common fields:
    // spec.minReplicas, spec.maxReplicas, spec.metrics[*].resource.target.averageUtilization (CPU)
    const min = h?.spec?.minReplicas;
    const max = h?.spec?.maxReplicas;
    // try to find CPU target %
    let cpu = null;
    const metrics = h?.spec?.metrics || [];
    for (const m of metrics) {
      if (m?.resource?.name?.toLowerCase() === "cpu") {
        cpu = m?.resource?.target?.averageUtilization ?? cpu;
      }
    }
    return { ok: true, min, max, cpu };
  } catch {
    return { ok: false };
  }
}

/**
 * Generate a scale plan from input specification
 * @param {Object} input - Plan input with target, namespace, workloads, autoscaling
 * @returns {Object} ScalePlan object with actions, risks, notes, and rollback hints
 */
export function makePlan(input) {
  const now = new Date().toISOString();
  const context = input.context || detectContext();
  const ns = input.namespace || "default";
  const actions = [];
  const notes = [];
  const risks = [];
  const detectionNotes = [];

  for (const w of (input.workloads || [])) {
    const id = `${w.kind}/${w.name}`;

    // Scale replicas
    if (w.replicas != null) {
      let fromVal = "unknown";
      const d = detectReplicas(w.kind, w.name, ns);
      if (d.ok) {
        fromVal = d.replicas;
        if (Number(w.replicas) === Number(d.replicas)) {
          detectionNotes.push(`No change: ${id} already at ${d.replicas} replicas.`);
        }
      } else {
        detectionNotes.push(`Could not detect current replicas for ${id} (no kubectl or no access).`);
      }
      actions.push({
        action: "scale_workload",
        kind: w.kind,
        name: w.name,
        namespace: ns,
        from: fromVal,
        to: w.replicas,
        reason: "requested_scale",
      });
      if (w.replicas > 10) {
        risks.push(`High replica count for ${id} → watch pod scheduling / quotas`);
      }
    }

    // Update resources (requests/limits)
    if (w.requests || w.limits) {
      actions.push({
        action: "update_resources",
        kind: w.kind,
        name: w.name,
        namespace: ns,
        requests: w.requests || null,
        limits: w.limits || null,
      });
    }

    // Apply HPA (HorizontalPodAutoscaler)
    if (input.autoscaling === "hpa" && w.hpa) {
      const from = detectHPA(w.name, ns);
      if (!from.ok) {
        detectionNotes.push(`Could not detect current HPA for ${id} (no kubectl or no access).`);
      }
      actions.push({
        action: "apply_hpa",
        kind: "HorizontalPodAutoscaler",
        name: w.name,
        namespace: ns,
        hpa: {
          min: w.hpa.min,
          max: w.hpa.max,
          targetCPU: w.hpa.targetCPU
        },
        from: {
          min: from.ok ? from.min ?? "unknown" : "unknown",
          max: from.ok ? from.max ?? "unknown" : "unknown",
          targetCPU: from.ok ? from.cpu ?? "unknown" : "unknown"
        }
      });

      // Check for replica count vs HPA max mismatch
      if (w.hpa.max && w.replicas && w.replicas > w.hpa.max) {
        notes.push(
          `Requested replicas (${w.replicas}) > HPA max (${w.hpa.max}) for ${id}; HPA will cap.`
        );
      }
    }
  }

  const plan = {
    apiVersion: "infra.scale/v1",
    kind: "ScalePlan",
    metadata: {
      createdAt: now,
      target: input.target || "unknown"
    },
    context: {
      kubeContext: context,
      namespace: ns
    },
    assumptions: {
      autoscaling: input.autoscaling || "none"
    },
    actions,
    rollbackHints: [
      "kubectl rollout undo deployment/<name> -n <namespace>",
      "kubectl apply -f previous-hpa.yaml"
    ],
    risks,
    notes: [...notes, ...detectionNotes]
  };

  return plan;
}
