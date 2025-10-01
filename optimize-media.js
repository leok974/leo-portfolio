import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import sharp from 'sharp';
import { glob } from 'glob';
import { program } from 'commander';
import { isEntrypoint } from './scripts/_esm-utils.mjs';

console.log('🚀 Media Optimization Script Starting...\n');

// Configuration
const CONFIG = {
  inputDir: './assets',
  outputDir: './assets/optimized',
  // Add HEIC/HEIF for mobile photos; keep SVG for vector inputs
  imageFormats: ['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.webp', '.svg', '.heic', '.heif'],
  // Treat GIF as video input for conversion to MP4/WebM
  videoFormats: ['.mp4', '.avi', '.mov', '.mkv', '.gif'],
  imageQuality: {
    webp: 85,
    avif: 60,
    jpeg: 85,
    png: 85 // quality used with palette=true
  },
  videoQuality: {
    webm: 'crf=30',
    mp4: 'crf=28'
  }
};

// CLI flags for more control/compatibility
program
  .option('--images-only', 'Process only images')
  .option('--videos-only', 'Process only videos')
  .option('--no-responsive', 'Skip generating responsive size variants')
  .option('--no-avif', 'Skip AVIF outputs')
  .option('--no-webp', 'Skip WebP outputs')
  .option('--no-jpeg', 'Skip JPEG outputs')
  .option('--no-png', 'Skip PNG outputs')
  .option('--posters', 'Extract poster frames from videos', true)
  .parse(process.argv);
const FLAGS = program.opts();

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Check if ffmpeg is available
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch (_error) {
    console.log('⚠️  FFmpeg not found. Video optimization will be skipped.');
    console.log('   To install FFmpeg: https://ffmpeg.org/download.html\n');
    return false;
  }
}

// Optimize images using Sharp
/**
 * @param {string} inputPath
 * @param {string} outputDir
 */
async function optimizeImage(inputPath, outputDir) {
  const ext = path.extname(inputPath).toLowerCase();
  const basename = path.basename(inputPath, ext);
  const relativePath = path.relative(CONFIG.inputDir, inputPath);
  const outputBase = path.join(outputDir, path.dirname(relativePath), basename);

  // Ensure output subdirectory exists
  const outputSubDir = path.dirname(path.join(outputDir, relativePath));
  if (!fs.existsSync(outputSubDir)) {
    fs.mkdirSync(outputSubDir, { recursive: true });
  }

  console.log(`📸 Optimizing: ${relativePath}`);

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    console.log(`   Original: ${metadata.width}x${metadata.height}, ${metadata.format}, ${Math.round(fs.statSync(inputPath).size / 1024)}KB`);

    // Generate WebP
    if (FLAGS.webp) {
      const webpPath = `${outputBase}.webp`;
      await image
        .clone()
        .webp({ quality: CONFIG.imageQuality.webp, effort: 6 })
        .toFile(webpPath);
      const webpSize = Math.round(fs.statSync(webpPath).size / 1024);
      console.log(`   → WebP: ${webpSize}KB`);
    }

    // Generate AVIF (more efficient but newer format)
    if (FLAGS.avif) {
      const avifPath = `${outputBase}.avif`;
      await image
        .clone()
        .avif({ quality: CONFIG.imageQuality.avif, effort: 6 })
        .toFile(avifPath);
      const avifSize = Math.round(fs.statSync(avifPath).size / 1024);
      console.log(`   → AVIF: ${avifSize}KB`);
    }

    // Generate optimized JPEG as broad fallback
    if (FLAGS.jpeg) {
      const jpegPath = `${outputBase}.jpg`;
      await image
        .clone()
        .jpeg({ quality: CONFIG.imageQuality.jpeg, progressive: true })
        .toFile(jpegPath);
      const jpegSize = Math.round(fs.statSync(jpegPath).size / 1024);
      console.log(`   → JPEG: ${jpegSize}KB`);
    }

    // Generate optimized PNG for UI/illustrations when wanted
    if (FLAGS.png) {
      const pngPath = `${outputBase}.png`;
      await image
        .clone()
        .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: CONFIG.imageQuality.png })
        .toFile(pngPath);
      const pngSize = Math.round(fs.statSync(pngPath).size / 1024);
      console.log(`   → PNG: ${pngSize}KB\n`);
    } else {
      console.log('');
    }

  } catch (_error) {
    const msg = _error instanceof Error ? _error.message : String(_error);
    console.error(`   ❌ Error optimizing ${relativePath}: ${msg}\n`);
  }
}

// Optimize videos using FFmpeg
/**
 * @param {string} inputPath
 * @param {string} outputDir
 */
function optimizeVideo(inputPath, outputDir) {
  const ext = path.extname(inputPath).toLowerCase();
  const basename = path.basename(inputPath, ext);
  const relativePath = path.relative(CONFIG.inputDir, inputPath);
  const outputBase = path.join(outputDir, path.dirname(relativePath), basename);

  // Ensure output subdirectory exists
  const outputSubDir = path.dirname(path.join(outputDir, relativePath));
  if (!fs.existsSync(outputSubDir)) {
    fs.mkdirSync(outputSubDir, { recursive: true });
  }

  console.log(`🎬 Optimizing: ${relativePath}`);

  try {
    const originalSize = Math.round(fs.statSync(inputPath).size / (1024 * 1024));
    console.log(`   Original: ${originalSize}MB`);

  // Generate WebM (VP9 codec, great for web)
    const webmPath = `${outputBase}.webm`;
    const webmCmd = `ffmpeg -i "${inputPath}" -c:v libvpx-vp9 -${CONFIG.videoQuality.webm} -c:a libopus -b:a 128k -y "${webmPath}"`;

    console.log(`   → Generating WebM...`);
    execSync(webmCmd, { stdio: 'ignore' });
    const webmSize = Math.round(fs.statSync(webmPath).size / (1024 * 1024));
    console.log(`   → WebM: ${webmSize}MB`);

  // Generate MP4 (H.264 codec, broad compatibility)
    const mp4Path = `${outputBase}.mp4`;
    const mp4Cmd = `ffmpeg -i "${inputPath}" -c:v libx264 -${CONFIG.videoQuality.mp4} -preset slow -c:a aac -b:a 128k -movflags +faststart -y "${mp4Path}"`;

    console.log(`   → Generating MP4...`);
    execSync(mp4Cmd, { stdio: 'ignore' });
    const mp4Size = Math.round(fs.statSync(mp4Path).size / (1024 * 1024));
    console.log(`   → MP4: ${mp4Size}MB`);

    // Optional: extract poster frames for convenience
    if (FLAGS.posters) {
      const posterBase = `${outputBase}-poster`;
      const posterJpg = `${posterBase}.jpg`;
      const posterWebp = `${posterBase}.webp`;
      try {
        const posterCmd = `ffmpeg -y -ss 00:00:01.000 -i "${inputPath}" -frames:v 1 -qscale:v 2 "${posterJpg}"`;
        execSync(posterCmd, { stdio: 'ignore' });
        console.log(`   → Poster JPG generated`);
        // Also create WebP for consistency
        sharp(posterJpg).webp({ quality: CONFIG.imageQuality.webp }).toFile(posterWebp);
        console.log(`   → Poster WebP generated`);
  } catch (_e) {
        console.log('   ⚠️  Poster extraction skipped (FFmpeg/sharp error)');
      }
      console.log('');
    } else {
      console.log('');
    }

  } catch (_error) {
   const msg = _error instanceof Error ? _error.message : String(_error);
   console.error(`   ❌ Error optimizing ${relativePath}: ${msg}\n`);
  }
}

// Generate responsive image sizes
/**
 * @param {string} inputPath
 * @param {string} outputDir
 */
async function generateResponsiveSizes(inputPath, outputDir) {
  const ext = path.extname(inputPath).toLowerCase();
  const basename = path.basename(inputPath, ext);
  const relativePath = path.relative(CONFIG.inputDir, inputPath);
  const outputBase = path.join(outputDir, path.dirname(relativePath), basename);

  // Include small sizes for avatars/icons and large sizes for covers
  const sizes = [
    { width: 160, suffix: '-xs' },
    { width: 320, suffix: '-sm' },
    { width: 800, suffix: '-md' },
    { width: 1200, suffix: '-lg' },
    { width: 1920, suffix: '-xl' }
  ];

  console.log(`📐 Generating responsive sizes for: ${relativePath}`);

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    for (const size of sizes) {
      // Allow small raster sources (<= 200px) to upscale up to 2x for crisp DPR
      const isSmallSource = metadata.width && metadata.width <= 200;
      const canDownscale = metadata.width ? metadata.width >= size.width || isSmallSource : true; // vectors are fine

      if (!canDownscale) continue;

      const resizeOpts = {
        withoutEnlargement: isSmallSource ? false : true,
        kernel: sharp.kernel.lanczos3
      };

      if (FLAGS.webp) {
        const webpPath = `${outputBase}${size.suffix}.webp`;
        await image.clone().resize(size.width, null, resizeOpts).webp({ quality: CONFIG.imageQuality.webp, effort: 6 }).toFile(webpPath);
        console.log(`   → ${size.width}px: ${path.basename(webpPath)}`);
      }
      if (FLAGS.avif) {
        const avifPath = `${outputBase}${size.suffix}.avif`;
        await image.clone().resize(size.width, null, resizeOpts).avif({ quality: CONFIG.imageQuality.avif, effort: 6 }).toFile(avifPath);
        console.log(`   → ${size.width}px: ${path.basename(avifPath)}`);
      }
      if (FLAGS.jpeg) {
        const jpgPath = `${outputBase}${size.suffix}.jpg`;
        await image.clone().resize(size.width, null, resizeOpts).jpeg({ quality: CONFIG.imageQuality.jpeg, progressive: true }).toFile(jpgPath);
        console.log(`   → ${size.width}px: ${path.basename(jpgPath)}`);
      }
      if (FLAGS.png) {
        const pngPath = `${outputBase}${size.suffix}.png`;
        await image.clone().resize(size.width, null, resizeOpts).png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: CONFIG.imageQuality.png }).toFile(pngPath);
        console.log(`   → ${size.width}px: ${path.basename(pngPath)}`);
      }
    }
    console.log('');

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Error generating responsive sizes: ${msg}\n`);
  }
}

// Main optimization function
async function optimizeMedia() {
  const hasFFmpeg = checkFFmpeg();

  // Find all media files
  const imagePattern = `${CONFIG.inputDir.replace(/\\/g,'/')}/**/*.{${CONFIG.imageFormats.map(e=>e.replace(/^\./,'')).join(',')}}`;
  const videoPattern = `${CONFIG.inputDir.replace(/\\/g,'/')}/**/*.{${CONFIG.videoFormats.map(e=>e.replace(/^\./,'')).join(',')}}`;
  const ignore = [`${CONFIG.outputDir.replace(/\\/g,'/')}/**/*`];

  const imageFiles = glob.sync(imagePattern, { nocase: true, ignore });
  const videoFiles = glob.sync(videoPattern, { nocase: true, ignore });

  console.log(`📊 Found ${imageFiles.length} images and ${videoFiles.length} videos\n`);

  // Optimize images
  if (imageFiles.length > 0 && !FLAGS.videosOnly) {
    console.log('🖼️  OPTIMIZING IMAGES\n' + '='.repeat(50));

    for (const imagePath of imageFiles) {
      try {
        const stat = fs.statSync(imagePath);
        if (!stat.size) { console.log(`   ⚠️  Skipping empty file: ${path.relative(CONFIG.inputDir, imagePath)}`); continue; }
      } catch {}
      await optimizeImage(imagePath, CONFIG.outputDir);
      if (FLAGS.responsive) {
        await generateResponsiveSizes(imagePath, CONFIG.outputDir);
      }
    }
  }

  // Optimize videos
  if (videoFiles.length > 0 && hasFFmpeg && !FLAGS.imagesOnly) {
    console.log('🎥 OPTIMIZING VIDEOS\n' + '='.repeat(50));

    for (const videoPath of videoFiles) {
      optimizeVideo(videoPath, CONFIG.outputDir);
    }
  }

  // Generate usage recommendations
  generateUsageGuide();
}

// Generate usage guide
function generateUsageGuide() {
  const guide = `# Media Optimization Results

## Usage Guide

### Images
Use the following HTML pattern for optimized images with broad fallbacks:

\`\`\`html
<picture>
  <source type="image/avif" srcset="assets/optimized/image-name.avif">
  <source type="image/webp" srcset="assets/optimized/image-name.webp">
  <source type="image/jpeg" srcset="assets/optimized/image-name.jpg">
  <img src="assets/optimized/image-name.png" alt="Description" loading="lazy" width="W" height="H">
</picture>
\`\`\`

### Responsive Images
For responsive images, use srcset across formats. Example widths: 400/800/1200/1920.

\`\`\`html
<picture>
  <source type="image/avif" srcset="assets/optimized/image-name-sm.avif 400w, assets/optimized/image-name-md.avif 800w, assets/optimized/image-name-lg.avif 1200w, assets/optimized/image-name-xl.avif 1920w" sizes="(max-width: 600px) 100vw, 50vw">
  <source type="image/webp" srcset="assets/optimized/image-name-sm.webp 400w, assets/optimized/image-name-md.webp 800w, assets/optimized/image-name-lg.webp 1200w, assets/optimized/image-name-xl.webp 1920w" sizes="(max-width: 600px) 100vw, 50vw">
  <source type="image/jpeg" srcset="assets/optimized/image-name-sm.jpg 400w, assets/optimized/image-name-md.jpg 800w, assets/optimized/image-name-lg.jpg 1200w, assets/optimized/image-name-xl.jpg 1920w" sizes="(max-width: 600px) 100vw, 50vw">
  <img src="assets/optimized/image-name-sm.png" alt="Description" loading="lazy" width="W" height="H">
</picture>
\`\`\`

### Videos
Use multiple sources for broad compatibility:

\`\`\`html
<video controls preload="metadata" poster="assets/optimized/video-name-poster.jpg">
  <source src="assets/optimized/video-name.webm" type="video/webm">
  <source src="assets/optimized/video-name.mp4" type="video/mp4">
  <track label="English" kind="captions" srclang="en" src="captions.vtt" default>
</video>
\`\`\`

## Performance Tips
- AVIF offers the best compression but limited browser support
- WebP is well-supported and offers great compression
 - Always provide JPEG and/or PNG fallbacks for images
- Use WebM for videos when possible, MP4 for compatibility
- Add \`loading="lazy"\` to images below the fold
- Use \`preload="metadata"\` for videos to load only metadata initially
 - For vector inputs (SVG), raster fallbacks ensure social/embed compatibility

Generated: ${new Date().toISOString()}
`;

  fs.writeFileSync(path.join(CONFIG.outputDir, 'README.md'), guide);
  console.log('📚 Usage guide generated: assets/optimized/README.md\n');
}

export async function main(){
  try {
    await optimizeMedia();
    console.log('✅ Media optimization complete!');
    console.log('📁 Optimized files saved to:', CONFIG.outputDir);
  } catch (error) {
    console.error('❌ Optimization failed:', error);
    process.exit(1);
  }
}

if (isEntrypoint(import.meta.url)) {
  await main();
}

export { optimizeMedia, CONFIG };
