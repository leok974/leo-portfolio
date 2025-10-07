#!/usr/bin/env node
/**
 * Video Poster Generator
 *
 * Extracts a single frame from a video file to use as a poster/thumbnail.
 * Requires ffmpeg to be installed and available in PATH.
 *
 * Usage:
 *   node scripts/make-video-poster.mjs <input.mp4> <output.jpg> [timecode]
 *   node scripts/make-video-poster.mjs dist/assets/video/clip.mp4 public/assets/video/clip.jpg
 *   node scripts/make-video-poster.mjs dist/assets/video/clip.mp4 public/assets/video/clip.jpg 00:00:05
 *
 * Via npm script:
 *   npm run poster -- dist/assets/video/clip.mp4 public/assets/video/clip.jpg
 */

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [, , inVid, outJpg, ts = "00:00:01"] = process.argv;

if (!inVid || !outJpg) {
  console.error("Usage: node scripts/make-video-poster.mjs <input.mp4> <out.jpg> [timecode]");
  console.error("");
  console.error("Examples:");
  console.error("  node scripts/make-video-poster.mjs video.mp4 poster.jpg");
  console.error("  node scripts/make-video-poster.mjs video.mp4 poster.jpg 00:00:05");
  console.error("");
  console.error("Timecode format: HH:MM:SS or MM:SS or SS");
  process.exit(1);
}

// Create output directory if needed
mkdirSync(dirname(outJpg), { recursive: true });

console.log(`[poster] Extracting frame from ${inVid} at ${ts} → ${outJpg}`);

// Run ffmpeg to extract single frame
const cmd = spawnSync(
  "ffmpeg",
  [
    "-y",           // Overwrite output file
    "-ss", ts,      // Seek to timecode
    "-i", inVid,    // Input video
    "-frames:v", "1", // Extract 1 frame
    outJpg          // Output image
  ],
  { stdio: "inherit" }
);

if (cmd.status === 0) {
  console.log(`[poster] ✓ Created ${outJpg}`);
} else {
  console.error(`[poster] ✗ Failed (exit code ${cmd.status})`);
}

process.exit(cmd.status ?? 0);
