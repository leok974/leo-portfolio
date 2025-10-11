/**
 * Lightweight metrics emitter to POST JSON to METRICS_URL
 *
 * Environment variables:
 * - METRICS_URL: Analytics collector endpoint (e.g., https://analytics.example.com/metrics)
 * - METRICS_KEY: Optional auth key sent in x-metrics-key header
 *
 * Usage:
 *   import { emitMetric } from "./analytics.mjs";
 *   await emitMetric("agent.task_started", { task: "seo.validate", run_id: "nightly-123" });
 */
import fetch, { AbortController } from "node-fetch";

const METRICS_URL = process.env.METRICS_URL || ""; // e.g., https://analytics.example.com/metrics
const METRICS_KEY = process.env.METRICS_KEY || ""; // optional auth

/**
 * Emit a metric event to the analytics collector
 * @param {string} event - Event name (e.g., "agent.task_started")
 * @param {object} payload - Additional event data
 */
export async function emitMetric(event, payload = {}) {
  if (!METRICS_URL) return; // noop if not configured
  try {
    const body = {
      ts: new Date().toISOString(),
      event,                 // e.g., agent.task_started
      source: "orchestrator",
      ...payload,
    };

    // Create timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    await fetch(METRICS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(METRICS_KEY ? { "x-metrics-key": METRICS_KEY } : {})
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch {
    /* swallow - metrics failures should not affect orchestration */
  }
}
