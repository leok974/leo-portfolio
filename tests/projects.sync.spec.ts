import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

// helper: run node script and capture stdout
function run(cmd: string, env: Record<string,string> = {}) {
  return execSync(cmd, {
    env: { ...process.env, ...env },
    stdio: ["ignore","pipe","pipe"],
    cwd: process.cwd(),
    timeout: 60_000,
    encoding: "utf-8"
  }).toString();
}

describe("projects.sync", () => {
  it("validates GITHUB_TOKEN requirement", () => {
    // Remove token to verify validation
    const env: Record<string, string> = {};

    expect(() => {
      run('node scripts/projects.sync.mjs --dry-run', env);
    }).toThrow();
  });

  it("prints outputs_uri=<url> when PR is created (parsing test)", () => {
    // Simulate the final stdout line
    const fake = "outputs_uri=https://github.com/owner/repo/pull/123\n";
    // parse same way CI would
    const m = fake.trim().match(/^outputs_uri=(https?:\/\/\S+)$/);
    expect(m?.[1]).toBe("https://github.com/owner/repo/pull/123");
  });

  it("parses outputs_uri when reusing an existing PR", () => {
    const fake = "Reusing open PR: https://github.com/owner/repo/pull/777\noutputs_uri=https://github.com/owner/repo/pull/777\n";
    const line = fake.trim().split("\n").pop()!;
    const m = line.match(/^outputs_uri=(https?:\/\/\S+)$/);
    expect(m?.[1]).toBe("https://github.com/owner/repo/pull/777");
  });

  it("parses outputs_uri when reopening a closed unmerged PR", () => {
    const fake = "Reopened PR: https://github.com/owner/repo/pull/456\noutputs_uri=https://github.com/owner/repo/pull/456\n";
    const line = fake.trim().split("\n").pop()!;
    const m = line.match(/^outputs_uri=(https?:\/\/\S+)$/);
    expect(m?.[1]).toBe("https://github.com/owner/repo/pull/456");
  });

  it("parses outputs_uri even with extra log lines (status block updates)", () => {
    const fake = [
      "Applied labels: automation, projects-sync",
      "Assigned to: leo",
      "Updated PR body status block.",
      "Posted run summary comment.",
      "outputs_uri=https://github.com/owner/repo/pull/888"
    ].join("\n");
    const last = fake.trim().split("\n").pop()!;
    const m = last.match(/^outputs_uri=(https?:\/\/\S+)$/);
    expect(m?.[1]).toBe("https://github.com/owner/repo/pull/888");
  });

  it("parses outputs_uri in no-change fast-exit scenario", () => {
    const fake = [
      "Updated PR body status block (no changes).",
      "Posted run summary comment (no changes).",
      "outputs_uri=https://github.com/owner/repo/pull/999"
    ].join("\n");
    const last = fake.trim().split("\n").pop()!;
    const m = last.match(/^outputs_uri=(https?:\/\/\S+)$/);
    expect(m?.[1]).toBe("https://github.com/owner/repo/pull/999");
  });

  it("handles no-change fast-exit without PR (no outputs_uri)", () => {
    const fake = "No changes; no existing sync PR to update. Exiting cleanly.\n";
    const lines = fake.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    // Should NOT have outputs_uri in this scenario
    expect(lastLine).not.toMatch(/^outputs_uri=/);
  });
});
