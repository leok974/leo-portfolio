import { test, expect, type APIRequestContext } from "@playwright/test";

// Base URL: use PLAYWRIGHT_BASE_URL or default to local dev backend
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8001";

// Helper to post an event
async function postEvent(ctx: APIRequestContext, body: any) {
  const res = await ctx.post(`${BASE}/api/metrics/event`, {
    data: body,
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(202);
  const json = await res.json();
  expect(json.ok).toBeTruthy();
}

// Generate a stable-ish visitor id for test runs
function vid() {
  return `test-${Date.now().toString(36)}`;
}

// Minimal payload template
function payload(event: string, meta: Record<string, any> = {}) {
  return {
    visitor_id: vid(),
    event,
    timestamp: new Date().toISOString(),
    metadata: meta,
  };
}

// Main spec
test.describe("Behavior Metrics API", () => {
  test("POST /event then GET /behavior reflects counts and returns last events", async ({ request }) => {
    // Post a few events
    await postEvent(request, payload("page_view", { path: "/" }));
    await postEvent(request, payload("link_click", { href: "https://example.com" }));
    await postEvent(request, payload("page_view", { path: "/projects" }));

    // Snapshot
    const res = await request.get(`${BASE}/api/metrics/behavior?limit=10`);
    expect(res.ok()).toBeTruthy();
    const snap = await res.json();

    expect(typeof snap.total).toBe("number");
    expect(Array.isArray(snap.by_event)).toBeTruthy();
    expect(Array.isArray(snap.last_events)).toBeTruthy();

    // Verify aggregation contains our event names
    const names = snap.by_event.map((b: any) => b.event);
    expect(new Set(names)).toEqual(new Set(["page_view", "link_click"]));

    // Verify last_events structure
    const first = snap.last_events[0];
    expect(first).toHaveProperty("visitor_id");
    expect(first).toHaveProperty("event");
    expect(first).toHaveProperty("timestamp");
  });

  test("Health endpoint returns sink existence and ring capacity", async ({ request }) => {
    const res = await request.get(`${BASE}/api/metrics/behavior/health`);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.ok).toBeTruthy();
    expect(typeof json.ring_capacity).toBe("number");
    expect(json).toHaveProperty("sink_exists");
  });
});
