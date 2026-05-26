import sharp from 'sharp';

const src = 'public/assets/logo.png';
const twa = 'twa/app/src/main/res';

const densities = [
  ['mipmap-mdpi',    48],
  ['mipmap-hdpi',    72],
  ['mipmap-xhdpi',   96],
  ['mipmap-xxhdpi',  144],
  ['mipmap-xxxhdpi', 192],
];

const splashDensities = [
  ['drawable-mdpi',    240],
  ['drawable-hdpi',    360],
  ['drawable-xhdpi',   480],
  ['drawable-xxhdpi',  720],
  ['drawable-xxxhdpi', 960],
];

for (const [dir, size] of densities) {
  const padding = Math.round(size * 0.12);
  const logoSize = size - padding * 2;

  const logo = await sharp(src)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();

  await sharp({ create: { width: size, height: size, channels: 3, background: { r: 10, g: 10, b: 10 } } })
    .composite([{ input: logo, top: padding, left: padding }])
    .png().toFile(`${twa}/${dir}/ic_launcher.png`);

  const maskPadding = Math.round(size * 0.17);
  const maskLogoSize = size - maskPadding * 2;
  const maskLogo = await sharp(src)
    .resize(maskLogoSize, maskLogoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 255 } } })
    .composite([{ input: maskLogo, top: maskPadding, left: maskPadding }])
    .png().toFile(`${twa}/${dir}/ic_maskable.png`);

  console.log(`✓ ${dir}: ic_launcher + ic_maskable (${size}x${size})`);
}

for (const [dir, size] of splashDensities) {
  const pad = Math.round(size * 0.15);
  const ls  = size - pad * 2;
  const logo = await sharp(src)
    .resize(ls, ls, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();

  await sharp({ create: { width: size, height: size, channels: 3, background: { r: 10, g: 10, b: 10 } } })
    .composite([{ input: logo, top: pad, left: pad }])
    .png().toFile(`${twa}/${dir}/splash.png`);

  console.log(`✓ ${dir}: splash.png (${size}x${size})`);
}
