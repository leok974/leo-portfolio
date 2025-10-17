import { test, expect } from '@playwright/test';

test('SEO tune creates artifacts (heuristic or LLM)', async ({ request }) => {
  const res = await request.post('https://assistant.ledger-mind.org/agent/seo.tune', {
    data: { dry_run: true }
  });
  expect(res.ok()).toBeTruthy();

  const result = await res.json();
  console.log('SEO tune result:', result);

  const artifacts = await request.get('https://assistant.ledger-mind.org/agent/artifacts');
  expect(artifacts.ok()).toBeTruthy();
  const list = await artifacts.text();

  // Should contain seo-tune artifacts
  expect(list).toMatch(/seo-tune\.(json|md)/);
  console.log('SEO artifacts found:', list.match(/seo-tune\.(json|md)/g));
});

test('SEO intelligence with analytics data', async ({ request }) => {
  // Test with mock analytics data if available
  const res = await request.post('https://assistant.ledger-mind.org/agent/seo.tune', {
    data: {
      dry_run: true,
      include_analytics: true
    }
  });

  expect(res.ok()).toBeTruthy();
  const result = await res.json();

  // Should have recommendations
  expect(result).toHaveProperty('recommendations');
  console.log('SEO recommendations:', result.recommendations);
});
