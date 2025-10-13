import { test, expect } from '@playwright/test';

const IS_CI = !!process.env.CI;

test.describe('CSP - Content Security Policy', () => {
  test('CSP header is present with script-src and nonce', async ({ request, baseURL }) => {
    test.skip(!IS_CI, 'Dev server does not serve CSP; covered in CI behind nginx');

    // Make a request to get the response headers
    const response = await request.get(baseURL || '/');

    expect(response.status()).toBe(200);

    // Check for CSP header (or report-only variant)
    const csp = response.headers()['content-security-policy'] ||
                response.headers()['content-security-policy-report-only'];

    expect(csp).toBeTruthy();
    expect(csp).toBeDefined();

    // Verify CSP contains script-src directive
    expect(csp!).toMatch(/script-src/i);

    // Verify CSP contains nonce directive
    expect(csp!).toMatch(/nonce-/);

    // Verify CSP contains 'strict-dynamic' for modern CSP
    expect(csp!).toMatch(/strict-dynamic/);
  });

  test('All script tags in HTML have nonce attribute', async ({ page }) => {
    test.skip(!IS_CI, 'Dev server uses nonce placeholder; covered in CI behind nginx');

    await page.goto('/');

    // Get all script elements
    const scripts = page.locator('script');
    const scriptCount = await scripts.count();

    expect(scriptCount).toBeGreaterThan(0);

    // Verify each script has a nonce attribute
    for (let i = 0; i < scriptCount; i++) {
      const script = scripts.nth(i);
      const nonceAttr = await script.getAttribute('nonce');

      // Skip if it's a JSON-LD script (application/ld+json doesn't execute)
      const typeAttr = await script.getAttribute('type');
      if (typeAttr === 'application/ld+json') {
        continue;
      }

      expect(nonceAttr).toBeTruthy();
      expect(nonceAttr).toMatch(/^[a-f0-9]{32}$/); // Should be a 32-char hex string
    }
  });

  test('CSP nonce in header matches nonce in HTML', async ({ page }) => {
    test.skip(!IS_CI, 'Dev server does not serve CSP; covered in CI behind nginx');

    const response = await page.goto('/');
    expect(response).not.toBeNull();

    // Extract nonce from CSP header
    const csp = response!.headers()['content-security-policy'];
    expect(csp).toBeTruthy();

    const nonceMatch = csp!.match(/nonce-([a-f0-9]{32})/);
    expect(nonceMatch).toBeTruthy();
    const headerNonce = nonceMatch![1];

    // Get nonce from first executable script tag
    const firstScript = page.locator('script[type="module"]').first();
    const htmlNonce = await firstScript.getAttribute('nonce');

    expect(htmlNonce).toBe(headerNonce);
  });

  test('CSP includes required directives for portfolio', async ({ request, baseURL }) => {
    test.skip(!IS_CI, 'Dev server does not serve CSP; covered in CI behind nginx');

    const response = await request.get(baseURL || '/');
    const csp = response.headers()['content-security-policy'];

    expect(csp).toBeTruthy();

    // Verify essential directives
    expect(csp!).toMatch(/default-src\s+'self'/);
    expect(csp!).toMatch(/script-src/);
    expect(csp!).toMatch(/style-src/);
    expect(csp!).toMatch(/img-src/);
    expect(csp!).toMatch(/connect-src/);

    // Verify Calendly domains are whitelisted
    expect(csp!).toMatch(/calendly\.com/);
    expect(csp!).toMatch(/assets\.calendly\.com/);

    // Verify backend domain is whitelisted for SSE
    expect(csp!).toMatch(/assistant\.ledger-mind\.org/);
  });
});
