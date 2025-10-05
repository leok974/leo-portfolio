import { test, expect } from '@playwright/test';

test.describe('@ui-polish Visual polish checks', () => {
  test('tw-animate-css utilities are available and animate', async ({ page, baseURL }) => {
    await page.goto(baseURL!);
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.setAttribute('data-test-anim', '1');
      el.className = 'animate-in fade-in slide-in-from-bottom-3 duration-500';
      el.textContent = 'anim';
      document.body.appendChild(el);
    });
    await page.waitForTimeout(50);
    const name = await page.$eval('[data-test-anim]', el => getComputedStyle(el as HTMLElement).animationName);
    const dur  = await page.$eval('[data-test-anim]', el => getComputedStyle(el as HTMLElement).animationDuration);
    expect(name).not.toBe('none');
    expect(dur).not.toBe('0s');
  });

  test('text-shadow utility works', async ({ page, baseURL }) => {
    await page.goto(baseURL!);
    await page.evaluate(() => {
      const el = document.createElement('h1');
      el.setAttribute('data-test-shadow', '1');
      el.className = 'text-shadow-lg';
      el.textContent = 'shadow';
      document.body.appendChild(el);
    });
    const shadow = await page.$eval('[data-test-shadow]', el => getComputedStyle(el as HTMLElement).textShadow);
    expect(shadow).not.toBe('none');
  });

  test('hover-glow applies glow shadow on hover', async ({ page, baseURL }) => {
    await page.goto(baseURL!);
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.setAttribute('data-test-glow', '1');
      el.className = 'hover-glow shadow-soft';
      el.style.cssText = 'width: 160px; height: 48px; background: #f3f4f6; border-radius: 8px;';
      document.body.appendChild(el);
    });
    const sel = '[data-test-glow]';
    const before = await page.$eval(sel, el => getComputedStyle(el as HTMLElement).boxShadow);
    await page.hover(sel);
    await page.waitForTimeout(400); // Wait for transition (300ms + buffer)
    const after = await page.$eval(sel, el => getComputedStyle(el as HTMLElement).boxShadow);
    expect(after).not.toEqual(before);
    // Verify glow shadow is applied (contains indigo rgba color)
    expect(after).toMatch(/rgba\(99,\s*102,\s*241/);
  });

  test('aspect-video utility sets aspect ratio', async ({ page, baseURL }) => {
    await page.goto(baseURL!);
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.setAttribute('data-test-aspect', '1');
      el.className = 'aspect-video w-96 bg-black/10';
      document.body.appendChild(el);
    });
    const aspect = await page.$eval('[data-test-aspect]', el => (getComputedStyle(el as HTMLElement) as any).aspectRatio || '');
    expect(String(aspect)).toContain('16 / 9'); // Chromium reports "16 / 9"
  });
});
