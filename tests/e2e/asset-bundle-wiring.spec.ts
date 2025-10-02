import { test, expect } from '@playwright/test';
import { BASE } from './helpers/env';
import { execSync } from 'node:child_process';

const ABS = (url: string) => (url.startsWith('http') ? url : `${BASE}${url.startsWith('/') ? '' : '/'}${url}`);

// --- helpers ---
function tryExec(cmd: string): string | null { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); } catch { return null; } }
function basenameFromUrl(u: string): string {
  const m = u.replace(/^https?:\/\/[^/]+/i, '').match(/\/([^/?#]+)(?:[?#].*)?$/);
  return m ? m[1] : u;
}
function listAssetsInContainer() {
  const path = '/usr/share/nginx/html/assets';
  const svc = process.env.NGINX_SERVICE || '';
  const ctr = process.env.NGINX_CONTAINER || '';
  const composeFiles = process.env.COMPOSE_FILES || '';
  const cmds: string[] = [];
  if (ctr) cmds.push(`docker exec -t ${ctr} sh -lc "ls -la ${path} | sed -n '1,200p'"`);
  if (svc && composeFiles) cmds.push(`docker compose -f ${composeFiles} exec -T ${svc} sh -lc "ls -la ${path} | sed -n '1,200p'"`);
  else if (svc) cmds.push(`docker compose exec -T ${svc} sh -lc "ls -la ${path} | sed -n '1,200p'"`);
  cmds.push(`docker compose exec -T web-test sh -lc "ls -la ${path} | sed -n '1,200p'"`);
  cmds.push(`docker compose exec -T nginx sh -lc "ls -la ${path} | sed -n '1,200p'"`);
  cmds.push(`docker exec -t web-test sh -lc "ls -la ${path} | sed -n '1,200p'"`);
  cmds.push(`docker exec -t nginx sh -lc "ls -la ${path} | sed -n '1,200p'"`);
  for (const cmd of cmds) { const out = tryExec(cmd); if (out) return { cmd, out }; }
  return null;
}

test.describe('@security @assets bundle wiring', () => {
  test('assets referenced by index.html resolve correctly (and exist on disk when 404)', async ({ request }) => {
    if (!process.env.NGINX_STRICT) {
      test.info().annotations.push({ type: 'skip-reason', description: 'NGINX_STRICT=1 not set' });
      test.skip(true, 'Requires nginx strict environment');
    }

    const resDoc = await request.get(`${BASE}/`, { headers: { Accept: 'text/html' } });
    expect(resDoc.status(), 'GET / should be 200').toBe(200);
    const html = await resDoc.text();
    expect((resDoc.headers()['content-type'] || '').toLowerCase()).toContain('text/html');

    const linkHref = Array.from(html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)).map(m => m[1]);
    const scriptSrc = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)).map(m => m[1]);
    const css = linkHref.filter(u => /\.css(\?|#|$)/i.test(u));
    const js  = scriptSrc.filter(u => /\.m?js(\?|#|$)/i.test(u));
    const manifest = linkHref.filter(u => /\.webmanifest(\?|#|$)/i.test(u));

    expect(css.length, 'No <link rel=stylesheet> *.css found in index.html').toBeGreaterThan(0);
    expect(js.length, 'No <script src> *.js found in index.html').toBeGreaterThan(0);

    const targets = [...new Set([...css, ...js, ...manifest])];
    test.info().annotations.push({ type: 'assets-ref', description: targets.join('\n') });

    for (const rel of targets) {
      const fileKey = basenameFromUrl(rel);
      const url = ABS(rel);
      const r = await request.get(url);
      const status = r.status();
      const ct = (r.headers()['content-type'] || '').toLowerCase();
      const cc = (r.headers()['cache-control'] || '').toLowerCase();

      if (status !== 200 && process.env.ASSET_DISK_ASSERT === '1') {
        const diag = listAssetsInContainer();
        if (diag) {
          const found = new RegExp(`\\b${fileKey.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`).test(diag.out);
          const headline = found ? `FOUND on disk: ${fileKey}` : `NOT FOUND on disk: ${fileKey}`;
            test.info().annotations.push({
            type: 'asset-404-disk',
            description: `cmd: ${diag.cmd}\n[diagnostic] ${headline}\n--- listing /usr/share/nginx/html/assets ---\n${diag.out}`
          });
        } else {
          test.info().annotations.push({
            type: 'asset-404-disk',
            description: 'Unable to inspect container; set NGINX_CONTAINER or NGINX_SERVICE/COMPOSE_FILES.'
          });
        }
      }

      expect(status, `GET ${url}`).toBe(200);
      expect(ct.includes('text/html')).toBeFalsy();

      if (/\.css(\?|#|$)/i.test(url)) {
        expect(ct.includes('text/css'), `Content-Type for ${url} was ${ct}`).toBeTruthy();
      } else if (/\.m?js(\?|#|$)/i.test(url)) {
        expect(/application\/javascript|text\/javascript/.test(ct), `Content-Type for ${url} was ${ct}`).toBeTruthy();
      } else if (/\.webmanifest(\?|#|$)/i.test(url)) {
        expect(ct.includes('application/manifest+json'), `Content-Type for ${url} was ${ct}`).toBeTruthy();
      }

      if (/\/(assets|css|js)\//i.test(url)) {
        expect(cc, `Cache-Control for ${url}`).toMatch(/immutable/);
        expect(cc).toMatch(/max-age=\d+/);
      }
    }
  });
});

