import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const plan = `
apiVersion: infra.scale/v1
kind: ScalePlan
context:
  namespace: testns
assumptions:
  autoscaling: hpa
rollbackHints:
  - previous-hpa.yaml
actions:
  - action: scale_workload
    kind: Deployment
    name: web
    to: 6
  - action: update_resources
    kind: Deployment
    name: web
  - action: apply_hpa
    kind: HorizontalPodAutoscaler
    name: web
    hpa:
      min: 4
      max: 12
      targetCPU: 65
`;

describe("infra.rollback (dry-run)", () => {
  const dir = path.join(process.cwd(), ".artifacts", "test-rollback");
  const file = path.join(dir, "plan.yaml");
  beforeAll(() => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, plan, "utf8"); });

  it("previews rollout undo and HPA hint apply", () => {
    const out = execSync(`node scripts/infra.rollback.mjs --plan=${file} --dry-run`, { encoding: "utf8" });
    expect(out).toMatch(/preview: kubectl -n testns rollout undo deployment\/web/);
    expect(out).toMatch(/preview: kubectl -n testns apply -f previous-hpa.yaml/);
    expect(out).toMatch(/succeeded/);
  });
});
