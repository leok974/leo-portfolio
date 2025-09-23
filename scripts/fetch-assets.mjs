import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://leok974.github.io/leo-portfolio/assets';
const OUT_DIR = 'assets';
const FILES = [
  // 'hero-poster.webp', // not present on live currently
  'hero-showreel.webm',
  'hero-showreel.mp4',
  'ledgermind-cover.webp',
  'datapipe-ai-cover.webp',
  'clarity-companion.webp',
  'leo-avatar.webp',
  'og-cover.png'
];

async function fetchBinary(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of FILES) {
    const url = `${BASE}/${f}`;
    const out = join(OUT_DIR, f);
    try {
      process.stdout.write(`↓ ${url} -> ${out}\n`);
      const buf = await fetchBinary(url);
      writeFileSync(out, buf);
    } catch (e) {
      console.warn(`⚠️  Skip ${f}: ${e.message}`);
    }
  }
  console.log('✅ Assets fetch step complete');
}

if (import.meta.main) {
  main().catch((e) => {
    console.error('❌ fetch-assets failed:', e.message);
    // Do not hard fail the build; allow following steps to run
    process.exit(0);
  });
}
