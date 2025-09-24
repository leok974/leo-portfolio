import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SRC_ROMAN = join(__dirname, '..', 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-wght-normal.woff2');
const SRC_ITALIC = join(__dirname, '..', 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-wght-italic.woff2');
const OUT_DIR = join(__dirname, '..', 'fonts');

mkdirSync(OUT_DIR, { recursive: true });

copyFileSync(SRC_ROMAN, join(OUT_DIR, 'Inter-roman.var.woff2'));
copyFileSync(SRC_ITALIC, join(OUT_DIR, 'Inter-italic.var.woff2'));

console.log('✅ Copied Inter variable fonts to /fonts');
