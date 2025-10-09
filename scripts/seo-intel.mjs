#!/usr/bin/env node
/**
 * SEO Intelligence Scanner
 *
 * Probes frontend and backend endpoints to generate SEO & analytics reports.
 * Part of Phase 50.9 nightly automation.
 */

import fs from "node:fs/promises";
import { existsSync } from "node:fs";

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.split("=");
    return [k.replace(/^--/, ""), v ?? true];
  })
);

const base = args.base ?? process.env.BASE_URL ?? "http://localhost:5173";
const backendUrl = args.backend ?? process.env.BACKEND_URL ?? "http://localhost:8001";
const outJson = args.out ?? "reports/summary.json";
const outMd = args.md ?? "reports/summary.md";

console.log(`🔍 SEO Intelligence Scanner`);
console.log(`   Base URL: ${base}`);
console.log(`   Backend URL: ${backendUrl}`);
console.log(`   Output: ${outJson}, ${outMd}\n`);

const checks = [];

// ============================================================================
// Frontend Checks
// ============================================================================

async function checkFrontend() {
  console.log("📄 Checking frontend...");

  try {
    // Check homepage
    const homeRes = await fetch(`${base}/`);
    if (!homeRes.ok) {
      checks.push({
        key: "home.status",
        ok: false,
        note: `Homepage returned ${homeRes.status}`,
      });
      return;
    }

    const html = await homeRes.text();

    // Title check
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch?.[1] || "";
    checks.push({
      key: "home.title",
      ok: title.length > 0 && title.length <= 60,
      note: title
        ? `Title: "${title}" (${title.length} chars)`
        : "Missing title",
    });

    // Meta description
    const descMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
    );
    const desc = descMatch?.[1] || "";
    checks.push({
      key: "home.meta.description",
      ok: desc.length >= 50 && desc.length <= 160,
      note: desc
        ? `Description: ${desc.length} chars`
        : "Missing or invalid description",
    });

    // Open Graph tags
    const ogTitleMatch = html.match(
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i
    );
    checks.push({
      key: "home.og.title",
      ok: !!ogTitleMatch,
      note: ogTitleMatch ? "OG title present" : "Missing og:title",
    });

    const ogImageMatch = html.match(
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i
    );
    checks.push({
      key: "home.og.image",
      ok: !!ogImageMatch,
      note: ogImageMatch ? "OG image present" : "Missing og:image",
    });

    // Canonical URL
    const canonicalMatch = html.match(
      /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i
    );
    checks.push({
      key: "home.canonical",
      ok: !!canonicalMatch,
      note: canonicalMatch ? `Canonical: ${canonicalMatch[1]}` : "Missing canonical",
    });

    // Structured data (JSON-LD)
    const jsonLdMatches = html.match(
      /<script\s+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis
    );
    checks.push({
      key: "home.jsonld",
      ok: !!jsonLdMatches && jsonLdMatches.length > 0,
      note: jsonLdMatches
        ? `${jsonLdMatches.length} JSON-LD blocks found`
        : "No structured data",
    });

    console.log(`   ✅ Homepage checked`);
  } catch (err) {
    checks.push({
      key: "home.fetch",
      ok: false,
      note: `Error fetching homepage: ${err.message}`,
    });
    console.error(`   ❌ Homepage check failed: ${err.message}`);
  }
}

// ============================================================================
// Backend Checks (Phase 50.8 Metrics)
// ============================================================================

async function checkBackend() {
  console.log("🔌 Checking backend...");

  try {
    // Ready endpoint
    const readyRes = await fetch(`${backendUrl}/ready`);
    checks.push({
      key: "backend.ready",
      ok: readyRes.ok,
      note: `Ready endpoint: ${readyRes.status}`,
    });

    // Metrics health
    const metricsHealthRes = await fetch(`${backendUrl}/api/metrics/behavior/health`);
    if (metricsHealthRes.ok) {
      const health = await metricsHealthRes.json();
      checks.push({
        key: "backend.metrics.health",
        ok: health.status === "healthy",
        note: `Metrics health: ring_size=${health.ring_size}, file_exists=${health.file_exists}`,
      });
    } else {
      checks.push({
        key: "backend.metrics.health",
        ok: false,
        note: `Metrics health endpoint: ${metricsHealthRes.status}`,
      });
    }

    // Metrics behavior snapshot
    const behaviorRes = await fetch(`${backendUrl}/api/metrics/behavior?limit=5`);
    if (behaviorRes.ok) {
      const snapshot = await behaviorRes.json();
      checks.push({
        key: "backend.metrics.snapshot",
        ok: snapshot.total !== undefined,
        note: `Metrics snapshot: ${snapshot.total} events, ${snapshot.by_event?.length || 0} event types`,
      });
    } else {
      checks.push({
        key: "backend.metrics.snapshot",
        ok: false,
        note: `Metrics snapshot endpoint: ${behaviorRes.status}`,
      });
    }

    console.log(`   ✅ Backend checked`);
  } catch (err) {
    checks.push({
      key: "backend.fetch",
      ok: false,
      note: `Error fetching backend: ${err.message}`,
    });
    console.error(`   ❌ Backend check failed: ${err.message}`);
  }
}

// ============================================================================
// Asset Optimization Checks
// ============================================================================

async function checkAssets() {
  console.log("🖼️  Checking assets...");

  // Check if optimized assets exist
  const optimizedDir = "assets/optimized";
  if (existsSync(optimizedDir)) {
    const files = await fs.readdir(optimizedDir, { recursive: true });
    const webpFiles = files.filter(f => f.endsWith(".webp"));
    const totalFiles = files.filter(f => !f.includes("/")).length; // Top-level files only

    checks.push({
      key: "assets.webp_ratio",
      ok: webpFiles.length > 0,
      note: `${webpFiles.length}/${totalFiles} optimized images (WebP)`,
    });
  } else {
    checks.push({
      key: "assets.optimized_dir",
      ok: false,
      note: "Optimized assets directory not found",
    });
  }

  console.log(`   ✅ Assets checked`);
}

// ============================================================================
// Privacy & Compliance Checks
// ============================================================================

async function checkPrivacy() {
  console.log("🔒 Checking privacy compliance...");

  try {
    // Check privacy.html exists
    const privacyRes = await fetch(`${base}/privacy.html`);
    checks.push({
      key: "privacy.page",
      ok: privacyRes.ok,
      note: privacyRes.ok ? "Privacy page accessible" : `Privacy page: ${privacyRes.status}`,
    });

    if (privacyRes.ok) {
      const html = await privacyRes.text();

      // Check for key privacy terms
      const hasDataCollection = html.includes("visitor_id") || html.includes("data collection");
      const hasRetention = html.includes("retention") || html.includes("30 days");
      const hasOptOut = html.includes("opt-out") || html.includes("dev=0");

      checks.push({
        key: "privacy.data_collection",
        ok: hasDataCollection,
        note: hasDataCollection ? "Data collection explained" : "Missing data collection details",
      });

      checks.push({
        key: "privacy.retention",
        ok: hasRetention,
        note: hasRetention ? "Retention policy present" : "Missing retention policy",
      });

      checks.push({
        key: "privacy.opt_out",
        ok: hasOptOut,
        note: hasOptOut ? "Opt-out instructions present" : "Missing opt-out instructions",
      });
    }

    console.log(`   ✅ Privacy checked`);
  } catch (err) {
    checks.push({
      key: "privacy.fetch",
      ok: false,
      note: `Error checking privacy: ${err.message}`,
    });
    console.error(`   ❌ Privacy check failed: ${err.message}`);
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  await checkFrontend();
  await checkBackend();
  await checkAssets();
  await checkPrivacy();

  // Calculate summary
  const summary = {
    base,
    backend_url: backendUrl,
    generated_at: new Date().toISOString(),
    totals: {
      passed: checks.filter(c => c.ok).length,
      failed: checks.filter(c => !c.ok).length,
      total: checks.length,
    },
    checks,
  };

  // Write JSON output
  await fs.mkdir("reports", { recursive: true });
  await fs.writeFile(outJson, JSON.stringify(summary, null, 2), "utf8");

  // Write Markdown output
  const mdLines = [
    `# Nightly SEO & Analytics`,
    ``,
    `- **Base URL**: ${base}`,
    `- **Backend URL**: ${backendUrl}`,
    `- **Generated**: ${summary.generated_at}`,
    ``,
    `## Summary`,
    ``,
    `✅ **${summary.totals.passed}** passed | ❌ **${summary.totals.failed}** failed | 📊 **${summary.totals.total}** total`,
    ``,
    `## Detailed Results`,
    ``,
  ];

  // Group checks by category
  const categories = {
    Frontend: checks.filter(c => c.key.startsWith("home.")),
    Backend: checks.filter(c => c.key.startsWith("backend.")),
    Assets: checks.filter(c => c.key.startsWith("assets.")),
    Privacy: checks.filter(c => c.key.startsWith("privacy.")),
  };

  for (const [category, categoryChecks] of Object.entries(categories)) {
    if (categoryChecks.length === 0) continue;

    mdLines.push(`### ${category}`);
    mdLines.push(``);
    for (const c of categoryChecks) {
      mdLines.push(`- ${c.ok ? "✅" : "❌"} **\`${c.key}\`** — ${c.note}`);
    }
    mdLines.push(``);
  }

  await fs.writeFile(outMd, mdLines.join("\n"), "utf8");

  console.log(`\n✅ Reports generated:`);
  console.log(`   📄 ${outJson}`);
  console.log(`   📝 ${outMd}`);
  console.log(`\n📊 Summary: ${summary.totals.passed}/${summary.totals.total} passed`);

  // Exit with error code if any checks failed
  if (summary.totals.failed > 0) {
    console.error(`\n❌ ${summary.totals.failed} checks failed`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
