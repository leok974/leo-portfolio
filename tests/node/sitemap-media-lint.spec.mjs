/**
 * Sitemap Media Linter Node Test
 *
 * Tests the validator with intentionally bad data to ensure it catches errors
 * Uses Node's built-in assert for zero dependencies
 */

import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';

// Setup test fixtures
const TEST_DIST = 'dist';
const TEST_MANIFEST = 'public/sitemap.media.json';

console.log('[test] Setting up test fixtures...');

// Ensure dist directories exist
mkdirSync('dist/assets/og', { recursive: true });
mkdirSync('dist/assets/video', { recursive: true });

// Create valid assets
writeFileSync('dist/assets/og/preview.png', Buffer.from([137, 80, 78, 71])); // PNG header
writeFileSync('dist/assets/video/thumb.jpg', Buffer.from([255, 216, 255, 224])); // JPEG header

// Create manifest with one valid image and one invalid video (missing content_loc file)
const testManifest = {
  "/": {
    images: [
      {
        loc: "/assets/og/preview.png",
        caption: "Valid image that exists"
      }
    ],
    videos: [
      {
        thumbnail_loc: "/assets/video/thumb.jpg",
        title: "Test Video",
        description: "This video references a missing file",
        content_loc: "/assets/video/demo.mp4"  // This file doesn't exist - should error
      }
    ]
  },
  "/missing-image.html": {
    images: [
      {
        loc: "/assets/og/missing.png",  // This file doesn't exist - should error
        caption: "Missing image"
      }
    ],
    videos: []
  }
};

writeFileSync(TEST_MANIFEST, JSON.stringify(testManifest, null, 2));

console.log('[test] Running strict linter (should fail)...');

let failed = false;
let output = '';
try {
  execSync('node scripts/validate-sitemap-media.mjs --strict', {
    stdio: 'pipe',
    encoding: 'utf8'
  });
} catch (e) {
  failed = true;
  output = e.stdout || '';
  console.log(output);
}

// Test 1: Strict mode should fail when assets are missing
assert.ok(failed, 'Strict lint should fail when assets are missing');
console.log('✓ Test 1 passed: Strict mode exits with error code when assets missing');

// Test 2: Output should contain error messages
assert.ok(output.includes('[media-lint:ERROR]'), 'Output should contain error messages');
console.log('✓ Test 2 passed: Error messages are present in output');

// Test 3: Should report missing demo.mp4
assert.ok(output.includes('demo.mp4'), 'Should report missing demo.mp4 file');
console.log('✓ Test 3 passed: Missing video file detected');

// Test 4: Should report missing.png
assert.ok(output.includes('missing.png'), 'Should report missing.png file');
console.log('✓ Test 4 passed: Missing image file detected');

// Test 5: Non-strict mode should pass (just warnings)
console.log('[test] Running non-strict linter (should pass)...');
try {
  execSync('node scripts/validate-sitemap-media.mjs', {
    stdio: 'pipe',
    encoding: 'utf8'
  });
  console.log('✓ Test 5 passed: Non-strict mode exits with code 0');
} catch (e) {
  assert.fail('Non-strict mode should not fail');
}

console.log('\n✓ All tests passed!');
