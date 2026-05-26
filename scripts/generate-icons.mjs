/**
 * Generates all PWA icon sizes + favicon.ico from public/assets/logo.png
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { writeFileSync } from 'fs';

const src = 'public/assets/logo.png';

const pwaSizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function buildIco(sizes) {
  const buffers = await Promise.all(
    sizes.map(size =>
      sharp(src)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );

  const count = sizes.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + count * dirEntrySize;

  let totalDataSize = 0;
  const offsets = [];
  for (const buf of buffers) {
    offsets.push(dirSize + totalDataSize);
    totalDataSize += buf.length;
  }

  const ico = Buffer.alloc(dirSize + totalDataSize);
  ico.writeUInt16LE(0, 0);       // reserved
  ico.writeUInt16LE(1, 2);       // type: ICO
  ico.writeUInt16LE(count, 4);   // count

  for (let i = 0; i < count; i++) {
    const off = headerSize + i * dirEntrySize;
    const s = sizes[i];
    ico.writeUInt8(s >= 256 ? 0 : s, off);
    ico.writeUInt8(s >= 256 ? 0 : s, off + 1);
    ico.writeUInt8(0, off + 2);
    ico.writeUInt8(0, off + 3);
    ico.writeUInt16LE(1, off + 4);
    ico.writeUInt16LE(32, off + 6);
    ico.writeUInt32LE(buffers[i].length, off + 8);
    ico.writeUInt32LE(offsets[i], off + 12);
  }

  let dataOffset = dirSize;
  for (const buf of buffers) {
    buf.copy(ico, dataOffset);
    dataOffset += buf.length;
  }
  return ico;
}

async function main() {
  // PWA icon sizes
  for (const size of pwaSizes) {
    await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(`public/icons/icon-${size}x${size}.png`);
    console.log(`✓ public/icons/icon-${size}x${size}.png`);
  }

  // Apple touch icon (180x180)
  await sharp(src)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('public/apple-touch-icon.png');
  console.log('✓ public/apple-touch-icon.png (180x180)');

  // favicon.ico (16, 32, 48)
  const ico = await buildIco([16, 32, 48]);
  writeFileSync('app/favicon.ico', ico);
  console.log('✓ app/favicon.ico (16x16, 32x32, 48x48)');
}

main().catch(err => { console.error(err); process.exit(1); });
