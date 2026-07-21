/**
 * Generates Play Store listing assets into play-store-assets/
 *
 * Produces:
 *   icon-512x512.png     — copy of twa/store_icon.png
 *   feature-graphic.png  — 1024×500 banner per spec
 *   screenshot-*.png     — 6 placeholder frames (1080×1920, 9:16)
 *                          For internal testing only. Replace with real app
 *                          screenshots before store listing submission.
 *
 * Run: node scripts/generate-play-store-assets.mjs
 */

import sharp from "sharp"
import { mkdirSync, copyFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const OUT  = join(ROOT, "play-store-assets")
const LOGO = join(ROOT, "public", "assets", "logo.png")

mkdirSync(OUT, { recursive: true })

// ─── 1. App icon (512×512) ────────────────────────────────────────────────────
// Source: public/icons/icon-512x512.png (same 512×512 logo, correct background)
const storeSrc = existsSync(join(ROOT, "twa", "store_icon.png"))
  ? join(ROOT, "twa", "store_icon.png")
  : join(ROOT, "public", "icons", "icon-512x512.png")
copyFileSync(storeSrc, join(OUT, "icon-512x512.png"))
console.log(`✓ icon-512x512.png  (copied from ${storeSrc.replace(ROOT, "")})`)

// ─── 2. Feature graphic (1024×500) ───────────────────────────────────────────
const FW = 1024, FH = 500
const LIME = "#a3e635"
const BG   = "#0a0a0a"

// Logo: 200px wide, vertically centred, left-padded 60px
const logoSize   = 200
const logoLeft   = 60
const logoTop    = Math.round((FH - logoSize) / 2)

const logoBuffer = await sharp(LOGO)
  .resize(logoSize, logoSize, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
  .png()
  .toBuffer()

// Text block (SVG overlay) — right side of graphic
const textSvg = `<svg width="${FW}" height="${FH}" xmlns="http://www.w3.org/2000/svg">
  <!-- EventSlot wordmark -->
  <text
    x="330" y="195"
    font-family="Arial, Helvetica, sans-serif"
    font-size="56" font-weight="bold"
    fill="#FFFFFF"
    letter-spacing="-1"
  >EventSlot</text>

  <!-- Tagline line 1 -->
  <text
    x="330" y="248"
    font-family="Arial, Helvetica, sans-serif"
    font-size="26" font-weight="normal"
    fill="#A3A3A3"
  >Smart Event Registration</text>

  <!-- Tagline line 2 -->
  <text
    x="330" y="284"
    font-family="Arial, Helvetica, sans-serif"
    font-size="26" font-weight="normal"
    fill="#A3A3A3"
  >&amp; Waitlist Management</text>

  <!-- Bottom lime strip -->
  <rect x="0" y="${FH - 8}" width="${FW}" height="8" fill="${LIME}" />
</svg>`

await sharp({
  create: { width: FW, height: FH, channels: 4, background: BG },
})
  .composite([
    { input: logoBuffer, left: logoLeft, top: logoTop },
    { input: Buffer.from(textSvg), top: 0, left: 0 },
  ])
  .png()
  .toFile(join(OUT, "feature-graphic.png"))

console.log("✓ feature-graphic.png  (1024×500)")

// ─── 3. Screenshot placeholders (1080×1920, 9:16 portrait) ───────────────────
const screenshots = [
  { n: 1, label: "Dashboard",          sub: "Active events with lime accent" },
  { n: 2, label: "Event Creation",     sub: "Custom questions &amp; capacity" },
  { n: 3, label: "Registration Form",  sub: "Public event page" },
  { n: 4, label: "AI Insights",        sub: "Insight cards" },
  { n: 5, label: "Community",          sub: "Leaderboard with badges" },
  { n: 6, label: "QR Scanner",         sub: "Scan mode selection" },
]

const SW = 1080, SH = 1920

for (const { n, label, sub } of screenshots) {
  const svg = `<svg width="${SW}" height="${SH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${SW}" height="${SH}" fill="${BG}" />

    <!-- Border -->
    <rect x="2" y="2" width="${SW - 4}" height="${SH - 4}"
          fill="none" stroke="#1a1a1a" stroke-width="4" />

    <!-- Top lime bar -->
    <rect x="0" y="0" width="${SW}" height="6" fill="${LIME}" />

    <!-- Placeholder icon -->
    <circle cx="${SW / 2}" cy="760" r="90"
            fill="none" stroke="${LIME}" stroke-width="6" opacity="0.4" />
    <text
      x="${SW / 2}" y="775"
      font-family="Arial, Helvetica, sans-serif"
      font-size="72" font-weight="bold" fill="${LIME}" opacity="0.4"
      text-anchor="middle"
    >${n}</text>

    <!-- Screen label -->
    <text
      x="${SW / 2}" y="980"
      font-family="Arial, Helvetica, sans-serif"
      font-size="64" font-weight="bold" fill="#FFFFFF"
      text-anchor="middle"
    >${label}</text>
    <text
      x="${SW / 2}" y="1058"
      font-family="Arial, Helvetica, sans-serif"
      font-size="36" fill="#A3A3A3"
      text-anchor="middle"
    >${sub}</text>

    <!-- Replace notice -->
    <text
      x="${SW / 2}" y="1680"
      font-family="Arial, Helvetica, sans-serif"
      font-size="28" fill="#525252"
      text-anchor="middle"
    >Replace with real app screenshot</text>
    <text
      x="${SW / 2}" y="1720"
      font-family="Arial, Helvetica, sans-serif"
      font-size="28" fill="#525252"
      text-anchor="middle"
    >before Play Store submission</text>

    <!-- Bottom lime strip -->
    <rect x="0" y="${SH - 6}" width="${SW}" height="6" fill="${LIME}" />
  </svg>`

  await sharp({ create: { width: SW, height: SH, channels: 4, background: BG } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(join(OUT, `screenshot-${n}.png`))

  console.log(`✓ screenshot-${n}.png  — ${label} (1080×1920 placeholder)`)
}

console.log("\nAll Play Store assets written to play-store-assets/")
console.log("⚠ Use screenshot-*.png only for planning/internal testing. Replace with real app screenshots before Play Store listing submission.")
