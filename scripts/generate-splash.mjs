/**
 * Generates iOS/Android PWA splash screens from public/assets/logo.png
 * Run: node scripts/generate-splash.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const LOGO_SRC = 'public/assets/logo.png';
const OUT_DIR  = 'public/splash';

const SPLASH_SIZES = [
  { width: 2048, height: 2732, name: 'splash-2048x2732'  }, // iPad Pro 12.9"
  { width: 1668, height: 2388, name: 'splash-1668x2388'  }, // iPad Pro 11"
  { width: 1290, height: 2796, name: 'splash-1290x2796'  }, // iPhone 14 Pro Max
  { width: 1179, height: 2556, name: 'splash-1179x2556'  }, // iPhone 14 Pro
  { width: 1170, height: 2532, name: 'splash-1170x2532'  }, // iPhone 14 / 13 / 12
  { width: 1080, height: 1920, name: 'splash-1080x1920'  }, // Generic / older iPhones
  { width:  750, height: 1334, name: 'splash-750x1334'   }, // iPhone SE / 8
];

mkdirSync(OUT_DIR, { recursive: true });

async function generate({ width, height, name }) {
  const logoSize  = Math.round(width * 0.25);          // 25% of width
  const logoX     = Math.round((width  - logoSize) / 2);
  const logoY     = Math.round((height - logoSize) / 2) - Math.round(height * 0.05);

  const fontSize      = Math.round(width * 0.055);
  const taglineSize   = Math.round(width * 0.03);
  const textY         = logoY + logoSize + Math.round(height * 0.06);
  const taglineY      = textY + fontSize + Math.round(height * 0.02);

  // Resize logo to target size
  const logo = await sharp(LOGO_SRC)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // SVG text layer (sharp can composite SVG natively)
  const textSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <text x="${width / 2}" y="${textY}"
            text-anchor="middle" dominant-baseline="auto"
            font-family="system-ui, -apple-system, sans-serif"
            font-weight="bold" font-size="${fontSize}" fill="#FFFFFF">EventSlot</text>
      <text x="${width / 2}" y="${taglineY}"
            text-anchor="middle" dominant-baseline="auto"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="${taglineSize}" fill="#525252">Smart Event Registration</text>
    </svg>`);

  await sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 10, b: 10 } },
  })
  .composite([
    { input: logo,    top: logoY, left: logoX },
    { input: textSvg, top: 0,     left: 0     },
  ])
  .png()
  .toFile(join(OUT_DIR, `${name}.png`));

  console.log(`✓ ${name}.png  (${width}×${height})`);
}

for (const size of SPLASH_SIZES) {
  await generate(size);
}
