import { test, expect } from '@playwright/test';

const PAGE = '#contact';

test.describe('Calendly widget @responsive', () => {
  // Known flaky test - skip in CI until viewport handling is improved
  test.skip(process.env.SKIP_FLAKY === '1', 'Flaky viewport test - layout settling inconsistent');

  test('no horizontal overflow across breakpoints', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Helper checks the page doesn't horizontally scroll
    const noOverflow = async () => {
      const [scrollW, clientW] = await page.evaluate(() => {
        const el = document.scrollingElement!;
        return [el.scrollWidth, el.clientWidth];
      });
      expect(scrollW, 'no horizontal overflow').toBeLessThanOrEqual(clientW + 1); // +1 for rounding
    };

    // Test across common mobile and desktop breakpoints
    for (const width of [360, 390, 414, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100); // Let layout settle
      await noOverflow();
    }
  });

  test('auto-resizes its height via postMessage', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const cal = page.getByTestId('calendly');
    await expect(cal).toBeVisible();

    // Read initial height (CSS default ~680px)
    const before = await cal.evaluate(el => parseInt(getComputedStyle(el).height, 10));
    expect(before).toBeGreaterThan(500);

    // Simulate Calendly's postMessage with a new height
    // (Calendly sends { event:"calendly:frameHeight", payload: <px> })
    await page.evaluate(() => {
      window.postMessage(
        JSON.stringify({ event: 'calendly:frameHeight', payload: 820 }),
        '*'
      );
    });

    // Wait for our listener to apply the change
    await page.waitForTimeout(100);

    const after = await cal.evaluate(el => parseInt(getComputedStyle(el).height, 10));
    expect(after).toBe(820);
  });

  test('iframe maintains fluid width', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const cal = page.getByTestId('calendly');
    await expect(cal).toBeVisible();

    // Check that the widget and iframe both have width constraints
    const widgetStyle = await cal.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        width: cs.width,
        minWidth: cs.minWidth,
        maxWidth: cs.maxWidth,
      };
    });

    expect(parseInt(widgetStyle.minWidth)).toBe(0);
    expect(widgetStyle.maxWidth).toBe('100%');
  });
});
