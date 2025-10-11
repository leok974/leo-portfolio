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

  for (const w of (input.workloads || [])) {
    const id = `${w.kind}/${w.name}`;

    // Scale replicas
    if (w.replicas != null) {
      actions.push({
        action: "scale_workload",
        kind: w.kind,
        name: w.name,
        namespace: ns,
        from: "${detect}",
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
    notes
  };

  return plan;
}
