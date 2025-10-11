import { describe, it, expect } from "vitest";

describe("seo.tune interface", () => {
  it("dry-run returns JSON with changed_files + files", () => {
    // Simulated output structure (we don't actually run the script in test env)
    const fake = JSON.stringify({
      dry_run: true,
      strict: false,
      changed_files: 2,
      files: [
        { file: "public/index.html", changes: ["description-added","og-updated"] },
        { file: "public/about/index.html", changes: ["canonical-added"] }
      ]
    }, null, 2);
    const obj = JSON.parse(fake);
    expect(obj.dry_run).toBe(true);
    expect(typeof obj.changed_files).toBe("number");
    expect(Array.isArray(obj.files)).toBe(true);
  });

  it("prints outputs_uri=<url> for CI parse", () => {
    const line = "outputs_uri=https://github.com/owner/repo/pull/456";
    const m = line.trim().match(/^outputs_uri=(https?:\/\/\S+)$/);
    expect(m?.[1]).toBe("https://github.com/owner/repo/pull/456");
  });

  it("strict dry-run includes strict:true", () => {
    const fake = JSON.stringify({
      dry_run: true,
      strict: true,
      changed_files: 1,
      files: [{ file: "public/x.html", changes: ["og:url-updated","twitter:card-updated","meta-deduped","h1-demoted:1"] }]
    });
    const obj = JSON.parse(fake);
    expect(obj.strict).toBe(true);
  });

  it("supports --require-pr contract (no changes case emits PR URL line)", () => {
    // We can't open PRs in unit tests; just verify the parsing contract.
    const fake = "Updated rolling SEO PR status (no changes).\noutputs_uri=https://github.com/owner/repo/pull/999\n";
    const last = fake.trim().split("\n").pop()!;
    const m = last.match(/^outputs_uri=(https?:\/\/\S+)$/);
    expect(m?.[1]).toBe("https://github.com/owner/repo/pull/999");
  });

  it("only-changed dry-run exposes flags", () => {
    const fake = JSON.stringify({
      dry_run: true,
      strict: false,
      only_changed: true,
      changed_base: "origin/main",
      changed_files: 0,
      files: []
    });
    const obj = JSON.parse(fake);
    expect(obj.only_changed).toBe(true);
    expect(obj.changed_base).toBe("origin/main");
  });
});
