import { buildPRBody } from "../scripts/infra.scale.mjs";

describe("PR body builder", () => {
  const plan = {
    metadata: { target: "prod" },
    context: { namespace: "assistant" },
    assumptions: { autoscaling: "hpa" },
    actions: [
      { action: "scale_workload", kind: "Deployment", name: "web", from: 3, to: 6 },
      { action: "update_resources", kind: "Deployment", name: "web",
        requests: { cpu: "500m", mem: "1Gi" }, limits: { cpu: "1", mem: "2Gi" } },
      { action: "apply_hpa", kind: "HorizontalPodAutoscaler", name: "web", hpa: { min: 4, max: 12, targetCPU: 65 } }
    ]
  };

  it("renders a markdown table with actions", () => {
    const md = buildPRBody({ plan, artifactPaths: true });
    expect(md).toMatch(/Infra Scale Plan — \*\*prod\*\*/);
    expect(md).toMatch(/Namespace: `assistant`/);
    expect(md).toMatch(/\| Action \| Target \| Details \|/);
    expect(md).toMatch(/Scale \| Deployment\/web .* replicas \*\*3 → 6\*\*/);
    expect(md).toMatch(/Resources \| Deployment\/web .* req `cpu=500m,mem=1Gi` · lim `cpu=1,mem=2Gi`/);
    expect(md).toMatch(/HPA \| web .* min \*\*4\*\* · max \*\*12\*\* · cpu \*\*65%/);
  });
});
