import { test, expect, request as playwrightRequest } from '@playwright/test';

test.describe('Resume Generation @resume', () => {
  test('dynamic resume includes latest projects', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    const res = await apiContext.get('/resume/generate.md');
    expect(res.status()).toBe(200);

    const contentType = res.headers()['content-type'] || '';
    expect(contentType).toMatch(/text\/markdown/);

    const md = await res.text();

    // Should have standard sections
    expect(md).toMatch(/## Projects \(latest\)/);
    expect(md).toMatch(/## Summary/);
    expect(md).toMatch(/## Skills/);
    expect(md).toMatch(/## Experience/);

    // Should have at least one project
    expect(md).toMatch(/- \*\*/); // Markdown list with bold title

    console.log('Resume preview (first 500 chars):');
    console.log(md.substring(0, 500));

    await apiContext.dispose();
  });

  test('resume has proper frontmatter', async ({ baseURL }) => {
    const apiContext = await playwrightRequest.newContext({ baseURL });

    const res = await apiContext.get('/resume/generate.md');
    const md = await res.text();

    // Should have YAML frontmatter
    expect(md).toMatch(/^---\n/);
    expect(md).toMatch(/name: /);
    expect(md).toMatch(/role: /);
    expect(md).toMatch(/email: /);
    expect(md).toMatch(/site: /);
    expect(md).toMatch(/github: /);
    expect(md).toMatch(/generated_at: /);

    await apiContext.dispose();
  });
});
