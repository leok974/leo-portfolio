#!/usr/bin/env node
// Generate favicon PNGs from source SVG using sharp.
// Ensures non-zero Content-Length for root icons referenced by manifest & tests.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const srcSvg = path.join(root, 'assets', 'leo-avatar.svg');
const outDir = path.join(root, 'public');
const targets = [
  { file: 'leo-avatar-sm.png', size: 192 },
  { file: 'leo-avatar-md.png', size: 512 }
];

async function main() {
  if (!fs.existsSync(srcSvg)) {
    console.error('[favicons] Source SVG missing:', srcSvg);
    process.exit(1);
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const svgBuffer = fs.readFileSync(srcSvg);
  for (const t of targets) {
    const outPath = path.join(outDir, t.file);
    try {
      const png = await sharp(svgBuffer).resize(t.size, t.size).png({ compressionLevel: 9 }).toBuffer();
      fs.writeFileSync(outPath, png);
      console.log(`[favicons] Wrote ${t.file} (${png.length} bytes)`);
    } catch (e) {
      console.error('[favicons] Failed for', t.file, e);
      process.exitCode = 1;
    }
  }
}

main();
