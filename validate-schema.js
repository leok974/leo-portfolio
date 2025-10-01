import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntrypoint } from './scripts/_esm-utils.mjs';

/**
 * @typedef {Record<string, unknown>} JsonLdNode
 */

/**
 * Simple JSON-LD extractor: finds <script type="application/ld+json"> blocks and parses JSON.
 * @param {string} html
 * @returns {JsonLdNode[]}
 */
function extractJsonLd(html) {
  const blocks = /** @type {JsonLdNode[]} */ ([]);
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    try {
      blocks.push(JSON.parse(raw));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error('Invalid JSON-LD block: ' + err.message);
    }
  }
  return blocks;
}

/**
 * Normalise JSON-LD graph structures into a flat array of nodes.
 * @param {unknown} obj
 * @returns {JsonLdNode[]}
 */
function flattenGraph(obj) {
  if (Array.isArray(obj)) {
    return obj.flatMap((item) => flattenGraph(item));
  }
  if (obj && typeof obj === 'object') {
    const record = /** @type {JsonLdNode} */ (obj);
    if (Object.prototype.hasOwnProperty.call(record, '@graph')) {
      return flattenGraph(record['@graph']);
    }
    return [record];
  }
  return [];
}

/**
 * Ensure specific fields exist on a JSON-LD node.
 * @param {JsonLdNode} node
 * @param {string[]} fields
 * @param {string} file
 * @param {string} type
 */
function ensureFields(node, fields, file, type) {
  for (const field of fields) {
    const value = node[field];
    if (value === undefined || value === null) {
      throw new Error(`${type} missing ${field} in ${file}`);
    }
    if (typeof value === 'string' && !value.trim()) {
      throw new Error(`${type} missing ${field} in ${file}`);
    }
  }
}

/**
 * Validate JSON-LD blocks for required schema structure.
 * @param {JsonLdNode[]} blocks
 * @param {string} file
 */
function validateBlocks(blocks, file) {
  const graph = flattenGraph(blocks);
  if (!graph.length) throw new Error(`No JSON-LD entities found in ${file}`);

  // Basic validations
  for (const node of graph) {
    const type = typeof node['@type'] === 'string' ? /** @type {string} */ (node['@type']) : undefined;
    if (!type) throw new Error(`Entity missing @type in ${file}`);

    if (type === 'SoftwareSourceCode') {
      ensureFields(node, ['name', 'description', 'url'], file, type);
    }
    if (type === 'CreativeWork') {
      ensureFields(node, ['name', 'description', 'url'], file, type);
    }
  }

  // Ensure we have at least one SoftwareSourceCode on project pages
  if (file.includes('projects') && !graph.some((node) => node['@type'] === 'SoftwareSourceCode')) {
    throw new Error(`Project page ${file} missing SoftwareSourceCode schema`);
  }
}

export function main() {
  // Derive project root directory; this file resides at repo root.
  const root = path.dirname(fileURLToPath(import.meta.url));
  const projectsDir = path.join(root, 'projects');
  const projectFiles = fs.existsSync(projectsDir)
    ? fs.readdirSync(projectsDir).filter((file) => file.endsWith('.html')).map((file) => `projects/${file}`)
    : [];
  const targets = ['index.html', ...projectFiles];
  let errorCount = 0;

  for (const file of targets) {
    try {
      const html = fs.readFileSync(path.join(root, file), 'utf8');
      const blocks = extractJsonLd(html);
      validateBlocks(blocks, file);
      console.log(`OK: ${file}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errorCount++;
      console.error(`FAIL: ${file} -> ${err.message}`);
    }
  }

  if (errorCount) {
    console.error(`Validation failed with ${errorCount} error(s).`);
    process.exit(1);
  } else {
    console.log('All JSON-LD validations passed.');
  }
}

if (isEntrypoint(import.meta.url)) main();
