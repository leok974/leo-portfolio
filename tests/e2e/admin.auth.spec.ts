/**
 * @file tests/e2e/admin.auth.spec.ts
 * E2E tests for HMAC-signed admin authentication (backend + frontend integration).
 *
 * Tests:
 * - Admin login (HMAC cookie)
 * - Auth status check (/api/auth/me)
 * - Protected endpoints (require admin)
 * - UI visibility (admin controls appear)
 * - Endpoint blocking without auth
 *
 * Usage:
 * - Local: PW_APP=portfolio ADMIN_TEST_EMAIL=you@example.com pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium
 * - Staging: PW_SITE=https://assistant.ledger-mind.org ADMIN_TEST_EMAIL=you@example.com pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium
 */

import { test, expect } from "@playwright/test";

const SITE = process.env.PW_SITE || "http://127.0.0.1:5174";
const EMAIL = process.env.ADMIN_TEST_EMAIL || "leoklemet.pa@gmail.com";

test.describe("Admin HMAC Authentication @backend @admin", () => {
  test("full workflow: login → auth check → protected endpoints → UI controls", async ({ page, context }) => {
    // 1) Admin login (get HMAC-signed cookie)
    const loginResp = await page.request.post(
      `${SITE}/api/auth/admin/login?email=${encodeURIComponent(EMAIL)}`
    );

    expect(loginResp.ok()).toBeTruthy();

    const setCookieHeader = loginResp.headers()["set-cookie"] || loginResp.headers()["Set-Cookie"];
    expect(setCookieHeader, "Should receive Set-Cookie header").toBeTruthy();

    // 2) Extract admin_auth cookie value
    const cookieMatch = /admin_auth=([^;]+)/.exec(setCookieHeader!);
    expect(cookieMatch, "Should extract admin_auth cookie value").toBeTruthy();
    const cookieValue = cookieMatch![1];

    // 3) Add cookie to browser context
    await context.addCookies([
      {
        name: "admin_auth",
        value: cookieValue,
        url: SITE,
        httpOnly: true,
        secure: SITE.startsWith("https"),
        sameSite: SITE.startsWith("https") ? "None" : "Lax",
      },
    ]);

    // 4) Verify /api/auth/me returns admin status
    const authResp = await page.request.get(`${SITE}/api/auth/me`);
    expect(authResp.ok()).toBeTruthy();

    const authData = await authResp.json();
    expect(authData.is_admin, "Should be recognized as admin").toBe(true);
    expect(authData.roles, "Should have admin role").toContain("admin");
    expect(authData.user, "Should have user object").toBeTruthy();
    expect(authData.user.email, "Should have correct email").toBe(EMAIL);

    // 5) Test protected endpoints (should succeed with cookie)
    const resetResp = await page.request.post(`${SITE}/api/layout/reset`);
    expect(resetResp.ok(), "Reset endpoint should return 200 with admin cookie").toBeTruthy();

    const autotuneResp = await page.request.post(`${SITE}/api/layout/autotune`);
    expect(autotuneResp.ok(), "Autotune endpoint should return 200 with admin cookie").toBeTruthy();

    // 6) Verify UI shows admin controls
    await page.goto(`${SITE}/`);

    // Wait for assistant panel to load
    await expect(page.getByTestId("assistant-panel")).toBeVisible();

    // Admin badge should be visible
    await expect(page.locator(".asst-badge-admin")).toBeVisible();
    await expect(page.locator(".asst-badge-admin")).toHaveText("admin");

    // Admin buttons should be visible (no ?admin=1 needed)
    await expect(page.getByTestId("btn-autotune")).toBeVisible();
    await expect(page.getByTestId("btn-reset")).toBeVisible();

    // Verify tooltips
    await expect(page.getByTestId("btn-autotune")).toHaveAttribute("title", "Admin only: Autotune layout");
    await expect(page.getByTestId("btn-reset")).toHaveAttribute("title", "Admin only: Reset layout");
  });

  test("protected endpoints block requests without cookie", async ({ request }) => {
    // Without admin cookie, should return 401 or 403
    const resetResp = await request.post(`${SITE}/api/layout/reset`);
    expect(resetResp.status(), "Reset without auth should return 401/403").toBeGreaterThanOrEqual(400);

    const autotuneResp = await request.post(`${SITE}/api/layout/autotune`);
    expect(autotuneResp.status(), "Autotune without auth should return 401/403").toBeGreaterThanOrEqual(400);
  });

  test("protected endpoints block requests with invalid cookie", async ({ request }) => {
    // With invalid cookie, should return 403
    const headers = { Cookie: "admin_auth=invalid_token_12345" };

    const resetResp = await request.post(`${SITE}/api/layout/reset`, { headers });
    expect(resetResp.status(), "Reset with invalid cookie should return 403").toBe(403);

    const autotuneResp = await request.post(`${SITE}/api/layout/autotune`, { headers });
    expect(autotuneResp.status(), "Autotune with invalid cookie should return 403").toBe(403);
  });

  test("SSE endpoints accessible with admin cookie (optional)", async ({ page, context }) => {
    // Login first
    const loginResp = await page.request.post(
      `${SITE}/api/auth/admin/login?email=${encodeURIComponent(EMAIL)}`
    );
    expect(loginResp.ok()).toBeTruthy();

    const setCookieHeader = loginResp.headers()["set-cookie"] || loginResp.headers()["Set-Cookie"];
    const cookieMatch = /admin_auth=([^;]+)/.exec(setCookieHeader!);
    const cookieValue = cookieMatch![1];

    await context.addCookies([
      {
        name: "admin_auth",
        value: cookieValue,
        url: SITE,
        httpOnly: true,
        secure: SITE.startsWith("https"),
        sameSite: SITE.startsWith("https") ? "None" : "Lax",
      },
    ]);

    // Test SSE endpoint (HEAD request)
    const sseResp = await page.request.head(`${SITE}/agent/events`);

    // Some backends return 200, some return 405 (Method Not Allowed) for HEAD on SSE
    // Both are acceptable as long as not 401/403
    expect(sseResp.status(), "SSE endpoint should not require auth").not.toBe(401);
    expect(sseResp.status(), "SSE endpoint should not forbid admin").not.toBe(403);
  });

  test("admin logout removes cookie", async ({ page, context }) => {
    // Login first
    const loginResp = await page.request.post(
      `${SITE}/api/auth/admin/login?email=${encodeURIComponent(EMAIL)}`
    );
    expect(loginResp.ok()).toBeTruthy();

    const setCookieHeader = loginResp.headers()["set-cookie"] || loginResp.headers()["Set-Cookie"];
    const cookieMatch = /admin_auth=([^;]+)/.exec(setCookieHeader!);
    const cookieValue = cookieMatch![1];

    await context.addCookies([
      {
        name: "admin_auth",
        value: cookieValue,
        url: SITE,
        httpOnly: true,
        secure: SITE.startsWith("https"),
        sameSite: SITE.startsWith("https") ? "None" : "Lax",
      },
    ]);

    // Verify admin status before logout
    const authBeforeResp = await page.request.get(`${SITE}/api/auth/me`);
    const authBefore = await authBeforeResp.json();
    expect(authBefore.is_admin).toBe(true);

    // Logout
    const logoutResp = await page.request.post(`${SITE}/api/auth/admin/logout`);
    expect(logoutResp.ok()).toBeTruthy();

    // Verify admin status after logout (should be false)
    const authAfterResp = await page.request.get(`${SITE}/api/auth/me`);
    const authAfter = await authAfterResp.json();
    expect(authAfter.is_admin, "Should not be admin after logout").toBe(false);

    // Protected endpoints should fail
    const resetResp = await page.request.post(`${SITE}/api/layout/reset`);
    expect(resetResp.status()).toBeGreaterThanOrEqual(400);
  });
});
