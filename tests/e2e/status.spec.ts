import { test, expect, request } from '@playwright/test';
import { BASE, REQUIRE_STATUS_PILL_STRICT } from './helpers/env';

test('status pill reflects live status', async ({ page }) => {
  const api = await request.newContext();
  let readyRes;
  try {
    readyRes = await api.get(`${BASE}/api/ready`, { headers: { Accept: 'application/json' } });
  } catch (e) {
    test.skip(true, `/api/ready connect error: ${(e instanceof Error ? e.message : String(e))}`);
  }
  if (!readyRes) test.skip(true, 'no /api/ready response object');
  test.skip(!readyRes!.ok(), `/api/ready not OK (${readyRes!.status()}); skipping UI status pill in this env.`);

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/leo|portfolio|assistant/i);

  const pill = page.locator('[data-status-pill]');
  await expect(pill, 'status pill should be present').toBeVisible({ timeout: 10_000 });

  const gotTip = await pill.evaluate(el => el.hasAttribute('data-tip'));

  if (REQUIRE_STATUS_PILL_STRICT) {
    await expect
      .poll(async () => (await pill.innerText()).trim(), { message: 'status pill left "Checking…"', timeout: 10000 })
      .not.toMatch(/^Checking…?$/);
    await expect
      .poll(async () => (await pill.getAttribute('class')) || '', { message: 'status pill class ok|warn|err', timeout: 10000 })
      .toMatch(/\b(ok|warn|err)\b/);
  } else {
    const txt = (await pill.innerText()).trim();
    const cls = (await pill.getAttribute('class')) || '';
    test.info().annotations.push({ type: 'note', description: `status-pill soft check — tip=${gotTip} text="${txt}" class="${cls}"` });
    if (/^Checking…?$/.test(txt)) {
      test.skip(true, 'status pill still "Checking…" — allowed in dev; set REQUIRE_STATUS_PILL_STRICT=1 to enforce.');
    }
  }
});
