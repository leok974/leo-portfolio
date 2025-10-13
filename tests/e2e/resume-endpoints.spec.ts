import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Resume Endpoints
 *
 * Verifies that all resume generation endpoints return 200 status
 * and produce content with expected types/structure.
 */

// Backend URL for API tests
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8001';

test.describe('Resume Endpoints - API Tests', () => {
  test('GET /resume/generate.md returns 200 with markdown content', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/resume/generate.md`);

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('text/markdown');

    const body = await res.text();
    expect(body).toContain('# Leo Klemet');
    expect(body).toContain('## About');
    expect(body.length).toBeGreaterThan(500); // Should have substantial content
  });

  test('GET /resume/generate.pdf returns 200 with PDF content', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/resume/generate.pdf`);

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('application/pdf');

    const buffer = await res.body();
    expect(buffer.length).toBeGreaterThan(1000); // PDFs should be at least 1KB

    // Verify PDF magic bytes
    const pdfHeader = buffer.slice(0, 5).toString('utf8');
    expect(pdfHeader).toBe('%PDF-');
  });

  test('GET /resume/copy.txt returns 200 and respects character limit', async ({ request }) => {
    const limit = 500;
    const res = await request.get(`${BACKEND_URL}/resume/copy.txt?limit=${limit}`);

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('text/plain');

    const body = await res.text();
    expect(body.length).toBeLessThanOrEqual(limit);
    expect(body).toContain('Leo Klemet');
  });

  test('GET /resume/generate.json returns 200 with valid structure', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/resume/generate.json`);

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('application/json');

    const data = await res.json();

    // Verify expected keys
    expect(data).toHaveProperty('headline');
    expect(data).toHaveProperty('about');
    expect(data).toHaveProperty('projects');
    expect(data).toHaveProperty('markdown');

    // Verify types
    expect(typeof data.headline).toBe('string');
    expect(typeof data.about).toBe('string');
    expect(Array.isArray(data.projects)).toBeTruthy();
    expect(typeof data.markdown).toBe('string');
  });

  test('Resume endpoints support role/seniority tuning parameters', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/resume/generate.md?roles=ai,swe&seniority=senior`);

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).toContain('Leo Klemet');
    // Tuned resumes should still have substantial content
    expect(body.length).toBeGreaterThan(500);
  });

  test('Resume copy endpoint respects LinkedIn character limits', async ({ request }) => {
    const linkedinLimit = 2600; // LinkedIn About section limit
    const res = await request.get(`${BACKEND_URL}/resume/copy.txt?limit=${linkedinLimit}`);

    expect(res.ok()).toBeTruthy();

    const body = await res.text();
    expect(body.length).toBeLessThanOrEqual(linkedinLimit);
    expect(body.length).toBeGreaterThan(200); // Should have meaningful content
  });
});

test.describe('Resume UI Integration Tests', () => {
  test('About section displays resume download buttons', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await expect(page.locator('h1')).toBeVisible();

    // Verify resume buttons are visible in About section
    await expect(page.getByTestId('resume-md-download')).toBeVisible();
    await expect(page.getByTestId('resume-pdf-download')).toBeVisible();
    await expect(page.getByTestId('resume-linkedin-copy')).toBeVisible();
  });

  test('Resume buttons have correct hrefs', async ({ page }) => {
    await page.goto('/');

    // Markdown download
    const mdButton = page.getByTestId('resume-md-download');
    await expect(mdButton).toHaveAttribute('href', '/resume/generate.md');
    await expect(mdButton).toHaveAttribute('download', 'Leo_Klemet_Resume.md');

    // PDF view
    const pdfButton = page.getByTestId('resume-pdf-download');
    await expect(pdfButton).toHaveAttribute('href', '/resume/generate.pdf');
    await expect(pdfButton).toHaveAttribute('target', '_blank');

    // LinkedIn copy
    const linkedinButton = page.getByTestId('resume-linkedin-copy');
    await expect(linkedinButton).toHaveAttribute('href', '/resume/copy.txt?limit=2600');
    await expect(linkedinButton).toHaveAttribute('target', '_blank');
  });

  test('Footer displays resume links', async ({ page }) => {
    await page.goto('/');

    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Verify footer resume links are visible
    await expect(page.getByTestId('footer-resume-md')).toBeVisible();
    await expect(page.getByTestId('footer-resume-pdf')).toBeVisible();
    await expect(page.getByTestId('footer-resume-linkedin')).toBeVisible();
  });

  test('Resume buttons are keyboard accessible', async ({ page }) => {
    await page.goto('/');

    // Tab to first resume button
    await page.keyboard.press('Tab');

    // Find the focused element
    const mdButton = page.getByTestId('resume-md-download');
    const pdfButton = page.getByTestId('resume-pdf-download');

    // Ensure buttons can receive focus
    await mdButton.focus();
    await expect(mdButton).toBeFocused();

    await pdfButton.focus();
    await expect(pdfButton).toBeFocused();
  });

  test('Resume buttons have proper ARIA labels', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('resume-md-download'))
      .toHaveAttribute('aria-label', 'Download Resume as Markdown');

    await expect(page.getByTestId('resume-pdf-download'))
      .toHaveAttribute('aria-label', 'View Resume as PDF');

    await expect(page.getByTestId('resume-linkedin-copy'))
      .toHaveAttribute('aria-label', 'Copy Resume for LinkedIn');
  });
});

test.describe('Resume Endpoint Error Handling', () => {
  test('Resume endpoints handle invalid parameters gracefully', async ({ request }) => {
    // Invalid seniority level
    const res1 = await request.get(`${BACKEND_URL}/resume/generate.md?seniority=invalid`);
    // Should either return 400 or fallback to defaults (still 200)
    expect([200, 400]).toContain(res1.status());

    // Excessive limit
    const res2 = await request.get(`${BACKEND_URL}/resume/copy.txt?limit=999999`);
    expect(res2.ok()).toBeTruthy();
    const body = await res2.text();
    // Should cap at max limit (e.g., 10000)
    expect(body.length).toBeLessThanOrEqual(10000);
  });

  test('Resume copy endpoint handles minimum limit', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/resume/copy.txt?limit=200`);

    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body.length).toBeLessThanOrEqual(200);
    expect(body.length).toBeGreaterThan(0); // Should have some content
  });
});

