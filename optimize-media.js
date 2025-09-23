const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');
const glob = require('glob');

console.log('🚀 Media Optimization Script Starting...\n');

// Configuration
const CONFIG = {
  inputDir: './assets',
  outputDir: './assets/optimized',
  imageFormats: ['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.webp'],
  videoFormats: ['.mp4', '.avi', '.mov', '.mkv'],
  imageQuality: {
    webp: 85,
    avif: 60,
    jpeg: 85
  },
  videoQuality: {
    webm: 'crf=30',
    mp4: 'crf=28'
  }
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Check if ffmpeg is available
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.log('⚠️  FFmpeg not found. Video optimization will be skipped.');
    console.log('   To install FFmpeg: https://ffmpeg.org/download.html\n');
    return false;
  }
}

// Optimize images using Sharp
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
    const webpPath = `${outputBase}.webp`;
    await image
      .clone()
      .webp({ quality: CONFIG.imageQuality.webp, effort: 6 })
      .toFile(webpPath);

    const webpSize = Math.round(fs.statSync(webpPath).size / 1024);
    console.log(`   → WebP: ${webpSize}KB`);

    // Generate AVIF (more efficient but newer format)
    const avifPath = `${outputBase}.avif`;
    await image
      .clone()
      .avif({ quality: CONFIG.imageQuality.avif, effort: 6 })
      .toFile(avifPath);

    const avifSize = Math.round(fs.statSync(avifPath).size / 1024);
    console.log(`   → AVIF: ${avifSize}KB`);

    // Generate optimized JPEG as fallback
    const jpegPath = `${outputBase}.jpg`;
    await image
      .clone()
      .jpeg({ quality: CONFIG.imageQuality.jpeg, progressive: true })
      .toFile(jpegPath);

    const jpegSize = Math.round(fs.statSync(jpegPath).size / 1024);
    console.log(`   → JPEG: ${jpegSize}KB\n`);

  } catch (error) {
    console.error(`   ❌ Error optimizing ${relativePath}: ${error.message}\n`);
  }
}

// Optimize videos using FFmpeg
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
    console.log(`   → MP4: ${mp4Size}MB\n`);

  } catch (error) {
    console.error(`   ❌ Error optimizing ${relativePath}: ${error.message}\n`);
  }
}

// Generate responsive image sizes
async function generateResponsiveSizes(inputPath, outputDir) {
  const ext = path.extname(inputPath).toLowerCase();
  const basename = path.basename(inputPath, ext);
  const relativePath = path.relative(CONFIG.inputDir, inputPath);
  const outputBase = path.join(outputDir, path.dirname(relativePath), basename);

  const sizes = [
    { width: 400, suffix: '-sm' },
    { width: 800, suffix: '-md' },
    { width: 1200, suffix: '-lg' },
    { width: 1920, suffix: '-xl' }
  ];

  console.log(`📐 Generating responsive sizes for: ${relativePath}`);

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    for (const size of sizes) {
      if (metadata.width && metadata.width > size.width) {
        // WebP variant
        const webpPath = `${outputBase}${size.suffix}.webp`;
        await image
          .clone()
          .resize(size.width, null, {
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos3
          })
          .webp({ quality: CONFIG.imageQuality.webp, effort: 6 })
          .toFile(webpPath);
        console.log(`   → ${size.width}px: ${path.basename(webpPath)}`);

        // AVIF variant
        const avifPath = `${outputBase}${size.suffix}.avif`;
        await image
          .clone()
          .resize(size.width, null, {
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos3
          })
          .avif({ quality: CONFIG.imageQuality.avif, effort: 6 })
          .toFile(avifPath);
        console.log(`   → ${size.width}px: ${path.basename(avifPath)}`);
      }
    }
    console.log('');

  } catch (error) {
    console.error(`   ❌ Error generating responsive sizes: ${error.message}\n`);
  }
}

// Main optimization function
async function optimizeMedia() {
  const hasFFmpeg = checkFFmpeg();

  // Find all media files
  const imagePattern = path.join(CONFIG.inputDir, `**/*{${CONFIG.imageFormats.join(',')}}`);
  const videoPattern = path.join(CONFIG.inputDir, `**/*{${CONFIG.videoFormats.join(',')}}`);

  const imageFiles = glob.sync(imagePattern, { nocase: true });
  const videoFiles = glob.sync(videoPattern, { nocase: true });

  console.log(`📊 Found ${imageFiles.length} images and ${videoFiles.length} videos\n`);

  // Optimize images
  if (imageFiles.length > 0) {
    console.log('🖼️  OPTIMIZING IMAGES\n' + '='.repeat(50));

    for (const imagePath of imageFiles) {
      await optimizeImage(imagePath, CONFIG.outputDir);
      await generateResponsiveSizes(imagePath, CONFIG.outputDir);
    }
  }

  // Optimize videos
  if (videoFiles.length > 0 && hasFFmpeg) {
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
Use the following HTML pattern for optimized images:

\`\`\`html
<picture>
  <source srcset="assets/optimized/image-name.avif" type="image/avif">
  <source srcset="assets/optimized/image-name.webp" type="image/webp">
  <img src="assets/optimized/image-name.jpg" alt="Description" loading="lazy">
</picture>
\`\`\`

### Responsive Images
For responsive images, use srcset:

\`\`\`html
<picture>
  <source media="(min-width: 1200px)" srcset="assets/optimized/image-name-xl.webp" type="image/webp">
  <source media="(min-width: 800px)" srcset="assets/optimized/image-name-lg.webp" type="image/webp">
  <source media="(min-width: 400px)" srcset="assets/optimized/image-name-md.webp" type="image/webp">
  <img src="assets/optimized/image-name-sm.webp" alt="Description" loading="lazy">
</picture>
\`\`\`

### Videos
Use multiple sources for broad compatibility:

\`\`\`html
<video controls preload="metadata" poster="assets/optimized/poster.webp">
  <source src="assets/optimized/video-name.webm" type="video/webm">
  <source src="assets/optimized/video-name.mp4" type="video/mp4">
  <track label="English" kind="captions" srclang="en" src="captions.vtt" default>
</video>
\`\`\`

## Performance Tips
- AVIF offers the best compression but limited browser support
- WebP is well-supported and offers great compression
- Always provide JPEG fallbacks for images
- Use WebM for videos when possible, MP4 for compatibility
- Add \`loading="lazy"\` to images below the fold
- Use \`preload="metadata"\` for videos to load only metadata initially

Generated: ${new Date().toISOString()}
`;

  fs.writeFileSync(path.join(CONFIG.outputDir, 'README.md'), guide);
  console.log('📚 Usage guide generated: assets/optimized/README.md\n');
}

// Run the optimization
if (require.main === module) {
  optimizeMedia()
    .then(() => {
      console.log('✅ Media optimization complete!');
      console.log('📁 Optimized files saved to:', CONFIG.outputDir);
    })
    .catch(error => {
      console.error('❌ Optimization failed:', error);
      process.exit(1);
    });
}

module.exports = { optimizeMedia, CONFIG };
