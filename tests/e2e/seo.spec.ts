import { test, expect } from '@playwright/test';

test.describe('SEO - JSON-LD and Meta Tags', () => {
  test('JSON-LD Person schema is present and valid', async ({ page }) => {
    await page.goto('/');

    // Check JSON-LD script exists (don't check visibility - scripts aren't "visible")
    const ldScript = page.locator('script[type="application/ld+json"]#jsonld-profile');
    await expect(ldScript).toHaveCount(1);

    // Get and parse JSON-LD content
    const ldContent = await ldScript.textContent();
    expect(ldContent).toBeTruthy();
    expect(ldContent).toContain('@type');
    expect(ldContent).toContain('Person');
    expect(ldContent).toContain('Leo Klemet');

    const jsonLd = JSON.parse(ldContent!);

    // Validate structure
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Person');
    expect(jsonLd.name).toBe('Leo Klemet');
    expect(jsonLd.url).toBe('https://assistant.ledger-mind.org');
    expect(jsonLd.jobTitle).toBe('AI Engineer');

    // Validate sameAs array
    expect(Array.isArray(jsonLd.sameAs)).toBe(true);
    expect(jsonLd.sameAs.length).toBeGreaterThan(0);
    expect(jsonLd.sameAs).toContain('https://github.com/leo-klemet');
    expect(jsonLd.sameAs).toContain('https://www.linkedin.com/in/leo-klemet/');
    expect(jsonLd.sameAs).toContain('https://www.artstation.com/leo_klemet');
  });

  test('Open Graph meta tags are present', async ({ page }) => {
    await page.goto('/');

    // Check og:title
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /Leo Klemet.*AI Engineer/);

    // Check og:description
    const ogDesc = page.locator('meta[property="og:description"]');
    await expect(ogDesc).toHaveAttribute('content', /.+/);

    // Check og:type
    const ogType = page.locator('meta[property="og:type"]');
    await expect(ogType).toHaveAttribute('content', 'website');

    // Check og:url
    const ogUrl = page.locator('meta[property="og:url"]');
    await expect(ogUrl).toHaveAttribute('content', 'https://assistant.ledger-mind.org/');

    // Check og:image - ensure it's og.png (tightened check)
    const ogImage = page.locator('meta[property="og:image"][content$="/og.png"]');
    await expect(ogImage).toHaveCount(1);
  });

  test('Twitter Card meta tags are present', async ({ page }) => {
    await page.goto('/');

    // Check twitter:card
    const twitterCard = page.locator('meta[name="twitter:card"]');
    await expect(twitterCard).toHaveAttribute('content', 'summary_large_image');

    // Check twitter:title
    const twitterTitle = page.locator('meta[name="twitter:title"]');
    await expect(twitterTitle).toHaveAttribute('content', /Leo Klemet/);

    // Check twitter:description
    const twitterDesc = page.locator('meta[name="twitter:description"]');
    await expect(twitterDesc).toHaveAttribute('content', /.+/);

    // Check twitter:image - ensure it's og.png (tightened check)
    const twitterImage = page.locator('meta[name="twitter:image"][content$="/og.png"]');
    await expect(twitterImage).toHaveCount(1);
  });

  test('Canonical link is present', async ({ page }) => {
    await page.goto('/');

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', 'https://assistant.ledger-mind.org/');
  });

  test('Page title and meta description are optimized', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/Leo Klemet.*AI Engineer/);

    // Check meta description
    const metaDesc = page.locator('meta[name="description"]');
    await expect(metaDesc).toHaveAttribute('content', /.{50,}/); // At least 50 chars
  });
});
