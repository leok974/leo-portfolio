import { test, expect } from '@playwright/test';

test('Dev overlay appears when cookie set and /agent routes are live', async ({ page }) => {
  // Prime cookie before navigation so SameSite=Lax doesn't block it
  await page.context().addCookies([{
    name: 'sa_dev',
    value: '1',              // or any non-empty marker if your code checks presence; in prod you rely on backend cookie
    domain: 'assistant.ledger-mind.org',
    path: '/',
    secure: true,
    httpOnly: false,
    sameSite: 'Lax'
  }]);

  await page.goto('https://assistant.ledger-mind.org/');

  // Overlay badge/toolbar visible
  const overlay = page.locator('[data-testid="dev-overlay"]');
  await expect(overlay).toBeVisible({ timeout: 10000 });

  // Status endpoint reachable
  const res = await page.request.get('https://assistant.ledger-mind.org/agent/dev/status');
  expect(res.status()).toBeLessThan(400);

  // Toggle/hide works
  const hideBtn = page.locator('[data-testid="dev-overlay-hide"]');
  if (await hideBtn.isVisible()) {
    await hideBtn.click();
    await expect(overlay).toBeHidden();
    await page.reload();
    await expect(overlay).toBeHidden(); // persisted
  }
});

test('Dev overlay enabled via /agent/dev/enable endpoint', async ({ page }) => {
  // Enable dev overlay via backend endpoint (with Authorization header)
  const enableRes = await page.request.get('https://assistant.ledger-mind.org/agent/dev/enable', {
    headers: {
      'Authorization': 'Bearer dev'
    }
  });

  // Should receive Set-Cookie header
  expect(enableRes.status()).toBeLessThan(400);

  // Navigate to site - cookie should be set by backend
  await page.goto('https://assistant.ledger-mind.org/');

  // Overlay should now be visible
  const overlay = page.locator('[data-testid="dev-overlay"]');
  await expect(overlay).toBeVisible({ timeout: 10000 });

  // Verify status endpoint confirms enabled
  const statusRes = await page.request.get('https://assistant.ledger-mind.org/agent/dev/status');
  expect(statusRes.status()).toBe(200);

  const status = await statusRes.json();
  expect(status.enabled).toBe(true);
});

test('overlay appears after enable (simplified)', async ({ request, page }) => {
  // Use the real enable endpoint
  const res = await request.get('https://assistant.ledger-mind.org/agent/dev/enable', {
    headers: { Authorization: 'Bearer dev' }
  });
  expect(res.ok()).toBeTruthy();

  // Navigate and verify overlay appears
  await page.goto('https://assistant.ledger-mind.org/');
  await expect(page.locator('[data-testid="dev-overlay"]')).toBeVisible();
});
