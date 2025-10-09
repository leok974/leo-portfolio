import { test, expect } from './test.base';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function write(p: string, buf: Buffer | string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
}

test('og-render script generates image with overrides + logo', async () => {
  // tiny 1x1 PNG
  const png = Buffer.from(
    '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000C49444154789C63000100000500010D0A2DB40000000049454E44AE426082',
    'hex'
  );
  write('assets/logos/siteagent.png', png);
  write('assets/data/projects.json', JSON.stringify({ projects: [{ name: 'leo-portfolio', description: 'e2e og', topics: ['og','e2e'], repo: 'owner/repo' }] }, null, 2));
  write('assets/data/og-overrides.json', JSON.stringify({
    brand: 'LEO KLEMET — SITEAGENT',
    title_alias: { 'leo-portfolio': 'siteAgent' },
    title_logo: { 'siteAgent': 'assets/logos/siteagent.png' }
  }, null, 2));

  // Run renderer
  execFileSync(process.execPath, ['scripts/og-render.mjs', '--input', './assets/data/projects.json', '--out', './assets/og', '--template', './public/og/template.html', '--overrides', './assets/data/og-overrides.json'], { stdio: 'inherit' });

  // Assert output exists (slug: siteagent.png)
  expect(fs.existsSync('assets/og/siteagent.png')).toBeTruthy();
  const stat = fs.statSync('assets/og/siteagent.png');
  expect(stat.size).toBeGreaterThan(0);
});
