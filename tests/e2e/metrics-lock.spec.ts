import { test, expect } from "@playwright/test";

const API = "http://127.0.0.1:8001";

test("dashboard is accessible from localhost without token (when METRICS_ALLOW_LOCALHOST=true)", async ({
  request,
}) => {
  // Localhost access should work by default in dev
  const res = await request.get(`${API}/agent/metrics/dashboard`);

  // Should either return HTML (200) or be forbidden (403) if localhost bypass disabled
  const status = res.status();
  const ct = res.headers()["content-type"] || "";

  if (status === 200) {
    // Verify it's HTML, not JSON
    expect(ct).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("Metrics Dashboard");
  } else if (status === 403) {
    // Acceptable if METRICS_ALLOW_LOCALHOST=false
    const body = await res.json();
    expect(body.detail).toBeTruthy();
  } else {
    throw new Error(`Unexpected status ${status}`);
  }
});

test("dashboard shows unlock screen for non-localhost access without token", async ({
  request,
}) => {
  // Simulate external request by using X-Forwarded-For
  const res = await request.get(`${API}/agent/metrics/dashboard`, {
    headers: {
      "X-Forwarded-For": "203.0.113.1", // External IP
    },
  });

  // Should return 401 (if METRICS_DEV_TOKEN set) or 403 (if not set) with unlock screen HTML
  const status = res.status();
  expect([401, 403]).toContain(status);
  const ct = res.headers()["content-type"] || "";
  expect(ct).toContain("text/html");
  const body = await res.text();
  expect(body).toContain("Unlock Metrics");
});

test("dashboard accepts valid token via query parameter", async ({
  request,
}) => {
  // Skip if METRICS_DEV_TOKEN not set
  const token = process.env.METRICS_DEV_TOKEN;
  if (!token) {
    test.skip();
    return;
  }

  const res = await request.get(
    `${API}/agent/metrics/dashboard?dev=${token}`,
    {
      headers: {
        "X-Forwarded-For": "203.0.113.1", // Simulate external
      },
    },
  );

  expect(res.status()).toBe(200);
  const ct = res.headers()["content-type"] || "";
  expect(ct).toContain("text/html");
  const body = await res.text();
  expect(body).toContain("Metrics Dashboard");
});

test("dashboard accepts valid token via Authorization header", async ({
  request,
}) => {
  const token = process.env.METRICS_DEV_TOKEN;
  if (!token) {
    test.skip();
    return;
  }

  const res = await request.get(`${API}/agent/metrics/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Forwarded-For": "203.0.113.1",
    },
  });

  expect(res.status()).toBe(200);
  const ct = res.headers()["content-type"] || "";
  expect(ct).toContain("text/html");
});

test("dashboard shows unlock screen with invalid token", async ({ request }) => {
  const res = await request.get(
    `${API}/agent/metrics/dashboard?dev=invalid-token-12345`,
    {
      headers: {
        "X-Forwarded-For": "203.0.113.1",
      },
    },
  );

  // Should return 403 with unlock screen HTML
  expect(res.status()).toBe(403);
  const ct = res.headers()["content-type"] || "";
  expect(ct).toContain("text/html");
  const body = await res.text();
  expect(body).toContain("Invalid Token");
});
