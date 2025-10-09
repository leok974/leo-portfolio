import { test, expect } from './test.base';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const BASELINE_PATH = process.env.ASSET_BASELINE ?? 'scripts/assets-digests-baseline.json';
const EXPECT_EDGE = process.env.EXPECT_EDGE === '1' || process.env.NGINX_STRICT === '1';
const STRICT_BASELINE = (process.env.STRICT_ASSET_BASELINE ?? '1') === '1';

test.skip(!EXPECT_EDGE, 'Edge headers not expected in static mode');

function extractAssets(html: string): string[] {
  const urls = new Set<string>();
  const patterns = [
    /<script[^>]+src=["']([^"']+\/assets\/[^"']+\.m?js)["']/gi,
    /<link[^>]+href=["']([^"']+\/assets\/[^"']+\.css)["']/gi,
    /<link[^>]+href=["']([^"']+\/assets\/[^"']+\.woff2?)["']/gi,
    /<img[^>]+src=["']([^"']+\/assets\/[^"']+\.(?:png|jpe?g|webp|gif|svg))["']/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) urls.add(m[1]);
  }
  if (urls.size === 0) {
    const fallback = /["'](\/assets\/[A-Za-z0-9._-]+\.(?:m?js|css|woff2?|png|jpe?g|webp|gif|svg))["']/g;
    let m: RegExpExecArray | null;
    while ((m = fallback.exec(html))) urls.add(m[1]);
  }
  return [...urls];
}

function sha256Hex(buf: Buffer | string) {
  return createHash('sha256').update(buf).digest('hex');
}

test('assets immutable + digest matches baseline', async ({ request }) => {
  let baseline: Record<string, { sha256: string; contentType?: string; cacheControl?: string }> = {};
  if (fs.existsSync(BASELINE_PATH)) {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).digests ?? {};
  } else if (STRICT_BASELINE) {
    test.fail(true, `Baseline not found at ${BASELINE_PATH}`);
  } else {
    test.info().annotations.push({ type: 'warn', description: `Baseline not found at ${BASELINE_PATH}` });
  }

  const root = await request.get(`${BASE}/`);
  expect(root.ok()).toBeTruthy();
  const html = await root.text();

  const assets = new Set(extractAssets(html));
  expect(assets.size).toBeGreaterThan(0);

  const failures: string[] = [];
  const digestMismatches: string[] = [];
  const missingInBaseline: string[] = [];

  for (const path of assets) {
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    const res = await request.get(url);
    const cc = (res.headers()['cache-control'] || '').toLowerCase();
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    const immutable = cc.includes('immutable');
    const mimeOk = /javascript|css|font|image\//.test(ct);
    if (!(res.ok() && immutable && mimeOk)) {
      failures.push(`${path} -> status:${res.status()} cc:${cc} ct:${ct}`);
      continue;
    }
    const body = Buffer.from(await res.body());
    const digest = sha256Hex(body);
    const b = baseline[path];
    if (!b) {
      missingInBaseline.push(path);
    } else if (b.sha256 !== digest) {
      digestMismatches.push(`${path}\n  expected: ${b.sha256}\n  actual:   ${digest}`);
    }
  }

  expect(failures, `Header/cache/MIME failures:\n- ${failures.join('\n- ')}`).toHaveLength(0);
  if (STRICT_BASELINE) {
    expect(missingInBaseline, `Assets missing in baseline:\n- ${missingInBaseline.join('\n- ')}`).toHaveLength(0);
  } else if (missingInBaseline.length) {
    test.info().annotations.push({ type: 'warn', description: `Missing in baseline: ${missingInBaseline.join(', ')}` });
  }
  expect(digestMismatches, `Digest mismatches:\n- ${digestMismatches.join('\n- ')}`).toHaveLength(0);
});
