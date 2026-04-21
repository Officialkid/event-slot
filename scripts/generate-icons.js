#!/usr/bin/env node
/**
 * scripts/generate-icons.js
 *
 * Generates all PWA icon sizes from a source image.
 *
 * Source: public/assets/logo-unfiltered.png (or public/icons/icon-source.png if provided)
 * Output: public/icons/icon-{size}x{size}.png
 *
 * NOTE: Replace the source file with the real EventSlot logo at 512x512px
 *       on a dark (#0a0a0a) background before running in production.
 *
 * Usage:
 *   node scripts/generate-icons.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.join(rootDir, 'public', 'icons');

// Prefer a dedicated source icon; fall back to the existing logo asset
const sourceIcon =
  fs.existsSync(path.join(iconsDir, 'icon-source.png'))
    ? path.join(iconsDir, 'icon-source.png')
    : path.join(rootDir, 'public', 'assets', 'logo-unfiltered.png');

async function main() {
  if (!fs.existsSync(sourceIcon)) {
    console.error(
      '❌  No source icon found.\n' +
      '   Place a 512x512 PNG at public/icons/icon-source.png and re-run.'
    );
    process.exit(1);
  }

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  console.log(`Using source: ${path.relative(rootDir, sourceIcon)}`);

  for (const size of SIZES) {
    const dest = path.join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(sourceIcon)
      .resize(size, size, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } })
      .png()
      .toFile(dest);
    console.log(`✓  icon-${size}x${size}.png`);
  }

  console.log('\n✅  All icons generated in public/icons/');
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
