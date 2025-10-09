import { test, expect } from './test.base';
// Skip unless hardened edge headers expected (nginx). In static dist serve these headers are absent.
const EXPECT_EDGE = process.env.EXPECT_EDGE === '1' || process.env.NGINX_STRICT === '1';
test.skip(!EXPECT_EDGE, 'Edge headers not expected in static mode');
import fs from 'node:fs';
import path from 'node:path';

// This spec enforces the CSP header matches the committed baseline exactly.
// Failing fast here short-circuits CI before the drift workflow.

const BASELINE_PATH = path.join(process.cwd(), 'scripts', 'expected-csp.txt');

test.describe('CSP baseline', () => {
  test('Content-Security-Policy header matches baseline', async ({ request, baseURL }) => {
    const baselineRaw = fs.readFileSync(BASELINE_PATH, 'utf8').trim();
    expect(baselineRaw.length).toBeGreaterThan(0);

    const res = await request.get(baseURL || '/', { failOnStatusCode: false });
    expect(res.status()).toBeLessThan(500);
    const header = res.headers()['content-security-policy'];
    expect(header, 'CSP header should be present').toBeTruthy();

    // Normalize formatting (baseline includes leading label already)
    const normalizedHeader = 'Content-Security-Policy: ' + header.replace(/\s+/g, ' ').trim();
    const normalizedBaseline = baselineRaw.replace(/\s+/g, ' ').trim();
    expect(normalizedHeader).toBe(normalizedBaseline);
  });
});
