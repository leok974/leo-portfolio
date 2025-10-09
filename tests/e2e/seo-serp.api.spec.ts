import { test, expect } from '@playwright/test';

test.describe('@seo-serp API', () => {
  test('mock populate → report has anomalies', async ({ request }) => {
    // Populate 3 days (2 back + today) with mock data
    const pop = await request.post('/agent/seo/serp/mock/populate', { data: { days: 2 } });
    expect([200, 404].includes(pop.status())).toBeTruthy(); // dev routes may be off in prod
    if (pop.status() !== 200) test.skip(true, 'Dev routes disabled');

    const rep = await request.get('/agent/seo/serp/report');
    expect(rep.ok()).toBeTruthy();
    const body = await rep.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.analysis).toBeTruthy();
    // Our mock injects a low-CTR page; anomalies should be >=1
    expect(body.analysis.anomalies.length).toBeGreaterThanOrEqual(1);
  });
});
