import type { Page } from '@playwright/test';

export async function installFastUI(page: Page) {
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (type === 'image' || type === 'font' || type === 'media') {
      return route.abort();
    }
    return route.continue();
  });

  await page.addStyleTag({
    content: `
      * { animation: none !important; transition: none !important; }
      html { scroll-behavior: auto !important; }
    `
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.setViewportSize({ width: 1200, height: 800 });
}
