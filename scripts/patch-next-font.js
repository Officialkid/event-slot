const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'compiled', '@next', 'font', 'dist', 'google', 'loader.js');

if (!fs.existsSync(targetFile)) {
  console.log('[patch-next-font] target loader.js not found, skipping');
  process.exit(0);
}

try {
  let content = fs.readFileSync(targetFile, 'utf8');
  const targetPattern = /const ext = \/\\\.\(woff\|woff2\|eot\|ttf\|otf\)\$\/\.exec\(googleFontFileUrl\)\[1\];/;
  const replacement = "const ext = (/\\.(woff|woff2|eot|ttf|otf)/i.exec(googleFontFileUrl) || [])[1] || 'woff2';";

  if (targetPattern.test(content)) {
    content = content.replace(targetPattern, replacement);
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-next-font] Successfully patched next/font loader.js extension fallback');
  } else if (content.includes("|| 'woff2'")) {
    console.log('[patch-next-font] Already patched');
  } else {
    console.log('[patch-next-font] Target pattern not found in loader.js');
  }
} catch (err) {
  console.error('[patch-next-font] Error applying patch:', err);
}
