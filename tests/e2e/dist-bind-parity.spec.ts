import { test, expect } from '@playwright/test';
import { BASE } from './helpers/env';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function tryExec(cmd: string): string | null {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); } catch { return null; }
}

function listContainerAssets(extraNote?: string) {
  const pathAssets = '/usr/share/nginx/html/assets';
  const svc = process.env.NGINX_SERVICE || '';
  const ctr = process.env.NGINX_CONTAINER || '';
  const composeFiles = process.env.COMPOSE_FILES || '';
  const cmds: string[] = [];
  if (ctr) cmds.push(`docker exec -t ${ctr} sh -lc "ls -la ${pathAssets} | sed -n '1,200p'; echo; awk '/<link|<script/ {print}' /usr/share/nginx/html/index.html"`);
  if (svc && composeFiles) cmds.push(`docker compose -f ${composeFiles} exec -T ${svc} sh -lc "ls -la ${pathAssets} | sed -n '1,200p'; echo; awk '/<link|<script/ {print}' /usr/share/nginx/html/index.html"`);
  else if (svc) cmds.push(`docker compose exec -T ${svc} sh -lc "ls -la ${pathAssets} | sed -n '1,200p'; echo; awk '/<link|<script/ {print}' /usr/share/nginx/html/index.html"`);
  cmds.push(`docker compose exec -T nginx sh -lc "ls -la ${pathAssets} | sed -n '1,200p'; echo; awk '/<link|<script/ {print}' /usr/share/nginx/html/index.html"`);
  cmds.push(`docker exec -t nginx sh -lc "ls -la ${pathAssets} | sed -n '1,200p'; echo; awk '/<link|<script/ {print}' /usr/share/nginx/html/index.html"`);
  for (const cmd of cmds) { const out = tryExec(cmd); if (out) return `cmd: ${cmd}\n${extraNote ? `[note] ${extraNote}\n` : ''}${out}`; }
  return null;
}

function detectDistDir(): string {
  const env = process.env.DIST_DIR;
  const candidates = env ? [env] : ['dist', path.join('apps', 'web', 'dist')];
  for (const d of candidates) {
    const p = path.join(d, 'index.html');
    if (fs.existsSync(p)) return d;
  }
  throw new Error(`Cannot find local dist folder; tried: ${candidates.join(', ')}`);
}

function parseRefs(html: string) {
  const links = Array.from(html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)).map(m => m[1]);
  const scripts = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)).map(m => m[1]);
  const css = links.filter(u => /\.css(?:[?#].*)?$/i.test(u));
  const js = scripts.filter(u => /\.m?js(?:[?#].*)?$/i.test(u));
  const manifest = links.filter(u => /\.webmanifest(?:[?#].*)?$/i.test(u));
  return { css, js, manifest, all: [...new Set([...css, ...js, ...manifest])] };
}

function toAbs(base: string, url: string) {
  return url.startsWith('http') ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

test.describe('@security @assets dist bind-mount parity', () => {
  test('served index refs == local dist refs; all under /assets; assets 200', async ({ request }) => {
    if (!process.env.NGINX_STRICT) {
      test.info().annotations.push({ type: 'skip-reason', description: 'NGINX_STRICT=1 not set' });
      test.skip(true);
    }

    const res = await request.get(`${BASE}/`, { headers: { Accept: 'text/html' } });
    expect(res.status(), 'GET / should be 200').toBe(200);
    const served = await res.text();
    expect((res.headers()['content-type'] || '').toLowerCase()).toContain('text/html');

    const distDir = detectDistDir();
    const local = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

    const servedRefs = parseRefs(served);
    const localRefs = parseRefs(local);

  const offenders = [...servedRefs.js, ...servedRefs.css].filter(u => /^\/[^/]+\.(m?js|css)([?#].*)?$/i.test(u));
    if (offenders.length) {
      const diag = listContainerAssets('Root-level *.js/*.css found; expected under /assets/');
      if (diag) test.info().annotations.push({ type: 'container-listing', description: diag });
    }
    expect(offenders, 'Root-level assets should not exist; move to /assets via Vite output.*').toHaveLength(0);

    const setEq = (a: string[], b: string[]) => {
      const A = new Set(a), B = new Set(b);
      if (A.size !== B.size) return false;
      for (const x of A) if (!B.has(x)) return false;
      return true;
    };

    const servedAll = servedRefs.all; const localAll = localRefs.all;
    if (!setEq(servedAll, localAll)) {
      test.info().annotations.push({
        type: 'ref-mismatch',
        description: `SERVE_ONLY:\n${servedAll.filter(x => !new Set(localAll).has(x)).join('\n') || '(none)'}\n\nLOCAL_ONLY:\n${localAll.filter(x => !new Set(servedAll).has(x)).join('\n') || '(none)'}`
      });
      const diag = listContainerAssets('Ref mismatch; bind mount may be stale/incorrect');
      if (diag) test.info().annotations.push({ type: 'container-listing', description: diag });
    }
    expect(setEq(servedAll, localAll), 'Served refs should equal local dist refs (bind-mount parity)').toBeTruthy();

    for (const rel of servedAll) {
      const url = toAbs(BASE, rel);
      const r = await request.get(url);
      const status = r.status();
      const ct = (r.headers()['content-type'] || '').toLowerCase();
      const cc = (r.headers()['cache-control'] || '').toLowerCase();

      if (status !== 200) {
        const diag = listContainerAssets(`Non-200 for ${rel}`);
        if (diag) test.info().annotations.push({ type: 'asset-non200', description: diag });
      }
      expect(status, `GET ${url}`).toBe(200);
      expect(ct.includes('text/html')).toBeFalsy();

      if (/\.css(?:[?#].*)?$/i.test(rel)) {
        expect(ct.includes('text/css')).toBeTruthy();
      } else if (/\.m?js(?:[?#].*)?$/i.test(rel)) {
        expect(/application\/javascript|text\/javascript/.test(ct)).toBeTruthy();
      } else if (/\.webmanifest(?:[?#].*)?$/i.test(rel)) {
        expect(ct.includes('application/manifest+json')).toBeTruthy();
      }

      if (/\/(assets|css|js)\//i.test(rel)) {
        expect(cc).toMatch(/immutable/);
        expect(cc).toMatch(/max-age=\d+/);
      }
    }
  });
});
