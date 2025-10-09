import { test, expect, Page } from './test.base';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5178';

async function elementIdAt(page: Page, x: number, y: number) {
  return await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x as number, y as number);
    if (!el) return null as any;
    const chip = (el as Element).closest('#assistantChip') as HTMLElement | null;
    return chip?.id ?? (el as HTMLElement).id ?? null;
  }, [x, y]);
}

test.describe('UI: assistant chip is not covered and is clickable', () => {
  test('chip is on top at its center and accepts click', async ({ page }) => {
    await page.goto(BASE);

    const chip = page.locator('#assistantChip');
    await expect(chip, 'assistant chip should be visible').toBeVisible();

    const box = await chip.boundingBox();
    expect(box, 'assistant chip has a bounding box').not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // 1) Fail fast if something sits on top of the chip
    const topId = await elementIdAt(page, cx, cy);
    expect(topId, 'topmost element at the chip center must be #assistantChip').toBe('assistantChip');

    // 2) Ensure it’s actually clickable (Playwright will error if intercepted)
    await chip.click({ trial: true });

    // 3) Sanity: chip must not have pointer-events: none
    const pe = await chip.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe).not.toBe('none');

    // 4) Real click should toggle the dock open without interception
    await chip.click();
    await expect(chip).toHaveAttribute('aria-expanded', 'true');
  });
});
