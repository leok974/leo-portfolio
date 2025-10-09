import { APIRequestContext } from '@playwright/test';

/**
 * Poll for artifact availability with smart content validation.
 * Supports both JSON and text artifacts (like MD).
 */
export async function waitForArtifact(
  api: APIRequestContext,
  path: string,
  headers: Record<string, string> = {},
  timeoutMs = 45_000
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let lastErr = '';

  while (Date.now() < deadline) {
    const r = await api.get(path, { headers });

    if (r.ok()) {
      const ct = (r.headers()['content-type'] || '').toLowerCase();

      if (ct.includes('application/json')) {
        const j = await r.json();
        // Validate JSON artifact has meaningful content
        if (Array.isArray(j.pages) && j.pages.length > 0) {
          return j;
        }
      } else {
        // Text artifact (MD, diff, etc.)
        const t = await r.text();
        if (t.includes('SEO Tune Report')) {
          return t;
        }
      }
    } else {
      lastErr = `${r.status()} ${await r.text()}`;
    }

    await new Promise(r => setTimeout(r, 800));
  }

  throw new Error(
    `Artifact ${path} not ready within ${timeoutMs}ms. ${lastErr ? 'Last: ' + lastErr : ''}`
  );
}
