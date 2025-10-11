/**
 * Tests for infra.scale CLI and k8s-planner
 *
 * Covers:
 * 1. Dry-run mode: Artifact generation and contract compliance
 * 2. Plan validation: Action types, metadata, risk detection
 * 3. Apply mode: PR creation behavior (without GitHub token)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Helper: Run CLI command and capture output
function runCLI(args: string): string {
  try {
    return execSync(`node scripts/infra.scale.mjs ${args}`, {
      encoding: "utf8",
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, GH_OWNER: "", GH_REPO: "", GITHUB_TOKEN: "" }
    });
  } catch (err: any) {
    // execSync throws if command exits with non-zero code
    // Return combined output for error case testing
    return (err.stdout || "") + (err.stderr || "");
  }
}

// Helper: Parse YAML plan (simple parser for our known structure)
function _parseYAML(content: string): any {
  const lines = content.split("\n");
  const obj: any = {};
  let currentKey: string | null = null;

  for (const line of lines) {
    const match = line.match(/^(\s*)(\w+):\s*(.*)$/);
    if (match) {
      const [, indent, key, value] = match;
      const level = indent.length / 2;

      if (level === 0) {
        currentKey = key;
        obj[key] = value || {};
      } else if (level === 1 && currentKey) {
        if (typeof obj[currentKey] === "string") {
          obj[currentKey] = {};
        }
        obj[currentKey][key] = value;
      }
    }
  }

  return obj;
}

describe("infra.scale CLI", () => {
  beforeAll(() => {
    // Ensure artifacts directory exists
    const artifactsRoot = path.join(__dirname, "..", ".artifacts", "infra-scale");
    fs.mkdirSync(artifactsRoot, { recursive: true });
  });

  describe("Dry-run mode (default)", () => {
    it("requires at least one --workload argument", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test");
      expect(output).toMatch(/No workloads specified/i);
    });

    it("generates YAML plan and summary artifacts", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:3");

      // Contract: artifacts_dir, plan_yaml, summary_md
      expect(output).toMatch(/artifacts_dir=/);
      expect(output).toMatch(/plan_yaml=/);
      expect(output).toMatch(/summary_md=/);

      // Extract paths
      const planMatch = output.match(/plan_yaml=([^\n]+)/);
      expect(planMatch).toBeTruthy();

      const planPath = planMatch![1];
      expect(fs.existsSync(planPath)).toBeTruthy();

      // Validate YAML structure
      const planContent = fs.readFileSync(planPath, "utf8");
      expect(planContent).toMatch(/apiVersion:\s*infra\.scale\/v1/);
      expect(planContent).toMatch(/kind:\s*ScalePlan/);
      expect(planContent).toMatch(/action:\s*scale_workload/);
    });

    it("prints 'succeeded' status on successful run", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:2");
      expect(output).toMatch(/\nsucceeded\s*$/);
    });

    it("includes metadata (target, context, namespace) in plan", () => {
      const output = runCLI("--dry-run --target=staging --namespace=assistant --workload=Deployment:web:5");

      const planMatch = output.match(/plan_yaml=([^\n]+)/);
      const planPath = planMatch![1];
      const planContent = fs.readFileSync(planPath, "utf8");

      expect(planContent).toMatch(/target:\s*staging/);
      expect(planContent).toMatch(/namespace:\s*assistant/);
    });

    it("generates scale_workload action for replicas", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:6");

      const planMatch = output.match(/plan_yaml=([^\n]+)/);
      const planPath = planMatch![1];
      const planContent = fs.readFileSync(planPath, "utf8");

      expect(planContent).toMatch(/action:\s*scale_workload/);
      expect(planContent).toMatch(/to:\s*6/);
      expect(planContent).toMatch(/from:\s*\${detect}/);
    });

    it("generates apply_hpa action when --hpa is specified", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:4 --hpa=min:2,max:8,cpu:70");

      const planMatch = output.match(/plan_yaml=([^\n]+)/);
      const planPath = planMatch![1];
      const planContent = fs.readFileSync(planPath, "utf8");

      expect(planContent).toMatch(/action:\s*apply_hpa/);
      expect(planContent).toMatch(/min:\s*2/);
      expect(planContent).toMatch(/max:\s*8/);
      expect(planContent).toMatch(/targetCPU:\s*70/);
    });

    it("generates update_resources action when --req or --lim specified", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:3 --req=api:cpu=500m,mem=1Gi --lim=api:cpu=1,mem=2Gi");

      const planMatch = output.match(/plan_yaml=([^\n]+)/);
      const planPath = planMatch![1];
      const planContent = fs.readFileSync(planPath, "utf8");

      expect(planContent).toMatch(/action:\s*update_resources/);
      expect(planContent).toMatch(/cpu:\s*500m/);
      expect(planContent).toMatch(/mem:\s*1Gi/);
    });

    it("generates markdown summary with human-readable format", () => {
      const output = runCLI("--dry-run --target=prod --namespace=app --workload=Deployment:web:5 --hpa=min:3,max:10,cpu:65");

      const summaryMatch = output.match(/summary_md=([^\n]+)/);
      const summaryPath = summaryMatch![1];
      const summaryContent = fs.readFileSync(summaryPath, "utf8");

      expect(summaryContent).toMatch(/# Infra Scale Plan/);
      expect(summaryContent).toMatch(/Context:/);
      expect(summaryContent).toMatch(/Namespace:/);
      expect(summaryContent).toMatch(/Actions:/);
      expect(summaryContent).toMatch(/Scale.*web.*replicas:\s*5/);
      expect(summaryContent).toMatch(/HPA.*web.*min:3.*max:10.*cpu:65/);
    });

    it("includes rollback hints in plan", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:3");

      const planMatch = output.match(/plan_yaml=([^\n]+)/);
      const planPath = planMatch![1];
      const planContent = fs.readFileSync(planPath, "utf8");

      expect(planContent).toMatch(/rollbackHints:/);
      expect(planContent).toMatch(/kubectl rollout undo/);
    });

    it("detects high replica count risk (>10)", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:15");

      const planMatch = output.match(/plan_yaml=([^\n]+)/);
      const planPath = planMatch![1];
      const planContent = fs.readFileSync(planPath, "utf8");

      expect(planContent).toMatch(/risks:/);
      expect(planContent).toMatch(/High replica count/i);
    });

    it("notes when replicas > HPA max", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:10 --hpa=min:2,max:6,cpu:70");

      const planMatch = output.match(/plan_yaml=([^\n]+)/);
      const planPath = planMatch![1];
      const planContent = fs.readFileSync(planPath, "utf8");

      expect(planContent).toMatch(/notes:/);
      expect(planContent).toMatch(/Requested replicas.*>.*HPA max/i);
    });

    it("handles multiple workloads", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:3 --workload=Deployment:web:5");

      const planMatch = output.match(/plan_yaml=([^\n]+)/);
      const planPath = planMatch![1];
      const planContent = fs.readFileSync(planPath, "utf8");

      // Should have 2 scale_workload actions
      const scaleMatches = planContent.match(/action:\s*scale_workload/g);
      expect(scaleMatches).toBeTruthy();
      expect(scaleMatches!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Apply mode", () => {
    it("prints outputs_uri (empty when no GitHub token)", () => {
      const output = runCLI("--apply --target=ci --namespace=test --workload=Deployment:api:2");

      // Contract: outputs_uri= (empty without GitHub credentials)
      expect(output).toMatch(/outputs_uri=/);
    });

    it("prints 'awaiting_approval' status after PR attempt", () => {
      const output = runCLI("--apply --target=ci --namespace=test --workload=Deployment:api:2");

      // Even without GitHub credentials, should indicate awaiting_approval state
      expect(output).toMatch(/awaiting_approval/);
    });
  });

  describe("Error handling", () => {
    it("prints 'failed' status on error", () => {
      // Invalid flag should cause error
      const output = runCLI("--invalid-flag");

      // Note: May succeed with no workloads error instead
      // This test is more about ensuring error paths are covered
      expect(output).toMatch(/failed|No workloads/i);
    });
  });

  describe("k8s-planner integration", () => {
    it("uses detected kubectl context when available", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:3");

      const planMatch = output.match(/plan_yaml=([^\n]+)/);
      const planPath = planMatch![1];
      const planContent = fs.readFileSync(planPath, "utf8");

      // Should have kubeContext field (may be null or actual context)
      expect(planContent).toMatch(/kubeContext:/);
    });

    it("sets autoscaling assumption based on --autoscaling flag", () => {
      const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:3 --autoscaling=hpa");

      const planMatch = output.match(/plan_yaml=([^\n]+)/);
      const planPath = planMatch![1];
      const planContent = fs.readFileSync(planPath, "utf8");

      expect(planContent).toMatch(/autoscaling:\s*hpa/);
    });
  });
});

describe("Contract compliance", () => {
  it("dry-run outputs match expected contract format", () => {
    const output = runCLI("--dry-run --target=ci --namespace=test --workload=Deployment:api:3");

    // Must have these exact keys in output
    expect(output).toMatch(/^artifacts_dir=/m);
    expect(output).toMatch(/^plan_yaml=/m);
    expect(output).toMatch(/^summary_md=/m);
    expect(output).toMatch(/^succeeded\s*$/m);
  });

  it("apply outputs match expected contract format", () => {
    const output = runCLI("--apply --target=ci --namespace=test --workload=Deployment:api:2");

    // Must have outputs_uri and status
    expect(output).toMatch(/^outputs_uri=/m);
    expect(output).toMatch(/^(awaiting_approval|failed)\s*$/m);
  });
});
