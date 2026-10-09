const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { chromium } = require('playwright');

const EVENT_NAME = "DISRUPTORS CONVENTION";
const EVENT_URL = "https://www.eventsslot.com/disruptors-convention-fykf";
const DISPLAY_URL = "eventsslot.com/disruptors-convention-fykf";

async function main() {
  const outputDir = path.join(__dirname, '..', 'public', 'documents');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Generate QR Code Data URL (High quality)
  const qrDataUrl = await QRCode.toDataURL(EVENT_URL, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 1000,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  const qrFilePath = path.join(outputDir, 'disruptors-convention-qr.png');
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
  fs.writeFileSync(qrFilePath, qrBuffer);

  // 2. Build Print-Ready HTML (794px x 1123px exact A4)
  const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Disruptors Convention - Official Registration Sign</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 794px;
      height: 1123px;
      max-width: 794px;
      max-height: 1123px;
      overflow: hidden;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    body {
      padding: 38px 46px 28px 46px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }

    /* Top decorative gradient bar */
    .top-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 10px;
      background: linear-gradient(90deg, #090d16 0%, #1e293b 45%, #059669 80%, #10b981 100%);
    }

    /* Dot pattern */
    .bg-grid {
      position: absolute;
      top: 10px;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: radial-gradient(#cbd5e1 1.2px, transparent 1.2px);
      background-size: 20px 20px;
      opacity: 0.45;
      pointer-events: none;
      z-index: 0;
    }

    .container {
      position: relative;
      z-index: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
    }

    /* Header */
    .header-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #f1f5f9;
      border: 1.5px solid #cbd5e1;
      color: #0f172a;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
      padding: 6px 20px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
    }
    .title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 44px;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1.05;
      text-transform: uppercase;
      color: #090d16;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 16px;
      font-weight: 700;
      color: #059669;
      letter-spacing: 0.5px;
      margin-bottom: 14px;
    }

    /* Welcome Card */
    .welcome-card {
      width: 100%;
      max-width: 650px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 16px;
      padding: 14px 24px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
    }
    .welcome-card h2 {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .welcome-card p {
      font-size: 12.5px;
      color: #475569;
      line-height: 1.45;
    }

    /* QR Hero */
    .qr-card {
      background: #ffffff;
      border: 3.5px solid #0f172a;
      border-radius: 28px;
      padding: 22px 28px 18px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
      position: relative;
      margin: 8px 0;
    }
    .qr-pill-top {
      position: absolute;
      top: -14px;
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 5px 22px;
      border-radius: 9999px;
    }
    .qr-img {
      width: 330px;
      height: 330px;
      display: block;
      margin: 4px 0 12px 0;
    }
    .qr-action-bar {
      background: #0f172a;
      color: #ffffff;
      border-radius: 12px;
      padding: 10px 26px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .qr-action-bar svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: #34d399;
      stroke-width: 2.2;
    }
    .qr-action-bar span {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1px;
    }

    /* 3-Step Instructions */
    .instructions-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      width: 100%;
      max-width: 660px;
    }
    .step-card {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
    }
    .step-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #0f172a;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 6px;
    }
    .step-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .step-desc {
      font-size: 10px;
      color: #64748b;
      line-height: 1.35;
    }

    /* Direct Link */
    .direct-link-bar {
      background: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      border-radius: 12px;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      max-width: 660px;
    }
    .direct-link-bar span {
      font-size: 12px;
      color: #475569;
      font-weight: 600;
    }
    .direct-link-bar strong {
      font-size: 13px;
      font-family: monospace;
      color: #0f172a;
      letter-spacing: 0.5px;
    }

    /* Footer */
    .footer-bar {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 10px;
      border-top: 1.5px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
    }
    .footer-left {
      font-weight: 700;
      color: #0f172a;
    }
    .footer-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge-eventslot {
      background: #0f172a;
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 5px;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="top-bar"></div>
  <div class="bg-grid"></div>

  <div class="container">
    <!-- Header Section -->
    <div class="header-section">
      <div class="badge">
        <span class="badge-dot"></span>
        Official Event Registration
      </div>
      <h1 class="title">${EVENT_NAME}</h1>
      <div class="subtitle">Navigating Corridors of Power &bull; Weekly Movement</div>

      <div class="welcome-card">
        <h2>Welcome to Disruptors Convention!</h2>
        <p>
          Thank you for being part of this inspiring movement. Please scan the official QR code below 
          to complete your registration and receive your verified entrance pass.
        </p>
      </div>
    </div>

    <!-- Hero QR Card -->
    <div class="qr-card">
      <div class="qr-pill-top">Fast Registration</div>
      <img src="${qrDataUrl}" alt="Disruptors Convention Registration QR" class="qr-img" />
      <div class="qr-action-bar">
        <svg viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>SCAN WITH ANY SMARTPHONE CAMERA</span>
      </div>
    </div>

    <!-- 3-Step Scan Instructions -->
    <div class="instructions-grid">
      <div class="step-card">
        <div class="step-num">1</div>
        <div class="step-title">Open Camera</div>
        <div class="step-desc">Open the native camera or QR scanner on your phone.</div>
      </div>
      <div class="step-card">
        <div class="step-num">2</div>
        <div class="step-title">Scan Code</div>
        <div class="step-desc">Point your lens directly at the QR code above.</div>
      </div>
      <div class="step-card">
        <div class="step-num">3</div>
        <div class="step-title">Access Ticket</div>
        <div class="step-desc">Tap the link to submit your details & get your ticket.</div>
      </div>
    </div>

    <!-- Direct URL Link -->
    <div class="direct-link-bar">
      <span>Or visit directly:</span>
      <strong>https://${DISPLAY_URL}</strong>
    </div>

    <!-- Footer -->
    <div class="footer-bar">
      <div class="footer-left">&copy; Disruptors Convention &bull; Official Registration Sign</div>
      <div class="footer-right">
        <span>Powered by</span>
        <span class="badge-eventslot">EVENTSLOT</span>
        <span>Instant Gate Check-in</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  // 3. Build Dark Edition
  const darkHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Disruptors Convention - Official Registration Sign (Dark Edition)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 794px;
      height: 1123px;
      max-width: 794px;
      max-height: 1123px;
      overflow: hidden;
      background: #090d16;
      color: #f8fafc;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    body {
      padding: 38px 46px 28px 46px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }

    .top-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 10px;
      background: linear-gradient(90deg, #10b981 0%, #059669 45%, #0284c7 100%);
    }

    .bg-glow {
      position: absolute;
      top: -50px;
      left: 50%;
      transform: translateX(-50%);
      width: 550px;
      height: 380px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.16) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }

    .container {
      position: relative;
      z-index: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
    }

    .header-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.08);
      border: 1.5px solid rgba(16, 185, 129, 0.35);
      color: #a7f3d0;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
      padding: 6px 20px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
    }
    .title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 44px;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1.05;
      text-transform: uppercase;
      color: #ffffff;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 16px;
      font-weight: 700;
      color: #34d399;
      letter-spacing: 0.5px;
      margin-bottom: 14px;
    }

    .welcome-card {
      width: 100%;
      max-width: 650px;
      background: rgba(255, 255, 255, 0.04);
      border: 1.5px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 14px 24px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .welcome-card h2 {
      font-size: 17px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .welcome-card p {
      font-size: 12.5px;
      color: #94a3b8;
      line-height: 1.45;
    }

    .qr-card {
      background: #ffffff;
      border: 4px solid #10b981;
      border-radius: 28px;
      padding: 22px 28px 18px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 0 50px rgba(16, 185, 129, 0.3);
      position: relative;
      margin: 8px 0;
    }
    .qr-pill-top {
      position: absolute;
      top: -14px;
      background: #10b981;
      color: #064e3b;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 5px 22px;
      border-radius: 9999px;
    }
    .qr-img {
      width: 330px;
      height: 330px;
      display: block;
      margin: 4px 0 12px 0;
    }
    .qr-action-bar {
      background: #0f172a;
      color: #ffffff;
      border-radius: 12px;
      padding: 10px 26px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .qr-action-bar svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: #34d399;
      stroke-width: 2.2;
    }
    .qr-action-bar span {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1px;
    }

    .instructions-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      width: 100%;
      max-width: 660px;
    }
    .step-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1.5px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .step-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #10b981;
      color: #064e3b;
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 6px;
    }
    .step-title {
      font-size: 12px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 2px;
    }
    .step-desc {
      font-size: 10px;
      color: #94a3b8;
      line-height: 1.35;
    }

    .direct-link-bar {
      background: rgba(255, 255, 255, 0.03);
      border: 1.5px dashed rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      max-width: 660px;
    }
    .direct-link-bar span {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 600;
    }
    .direct-link-bar strong {
      font-size: 13px;
      font-family: monospace;
      color: #34d399;
      letter-spacing: 0.5px;
    }

    .footer-bar {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 10px;
      border-top: 1.5px solid rgba(255, 255, 255, 0.1);
      font-size: 11px;
      color: #64748b;
    }
    .footer-left {
      font-weight: 700;
      color: #94a3b8;
    }
    .footer-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge-eventslot {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      font-size: 9px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 5px;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="top-bar"></div>
  <div class="bg-glow"></div>

  <div class="container">
    <div class="header-section">
      <div class="badge">
        <span class="badge-dot"></span>
        Official Event Registration
      </div>
      <h1 class="title">${EVENT_NAME}</h1>
      <div class="subtitle">Navigating Corridors of Power &bull; Weekly Movement</div>

      <div class="welcome-card">
        <h2>Welcome to Disruptors Convention!</h2>
        <p>
          Thank you for being part of this inspiring movement. Please scan the official QR code below 
          to complete your registration and receive your verified entrance pass.
        </p>
      </div>
    </div>

    <div class="qr-card">
      <div class="qr-pill-top">Fast Registration</div>
      <img src="${qrDataUrl}" alt="Disruptors Convention Registration QR" class="qr-img" />
      <div class="qr-action-bar">
        <svg viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>SCAN WITH ANY SMARTPHONE CAMERA</span>
      </div>
    </div>

    <div class="instructions-grid">
      <div class="step-card">
        <div class="step-num">1</div>
        <div class="step-title">Open Camera</div>
        <div class="step-desc">Open the native camera or QR scanner on your phone.</div>
      </div>
      <div class="step-card">
        <div class="step-num">2</div>
        <div class="step-title">Scan Code</div>
        <div class="step-desc">Point your lens directly at the QR code above.</div>
      </div>
      <div class="step-card">
        <div class="step-num">3</div>
        <div class="step-title">Access Ticket</div>
        <div class="step-desc">Tap the link to submit your details & get your ticket.</div>
      </div>
    </div>

    <div class="direct-link-bar">
      <span>Or visit directly:</span>
      <strong>https://${DISPLAY_URL}</strong>
    </div>

    <div class="footer-bar">
      <div class="footer-left">&copy; Disruptors Convention &bull; Official Registration Sign</div>
      <div class="footer-right">
        <span>Powered by</span>
        <span class="badge-eventslot">EVENTSLOT</span>
        <span>Instant Gate Check-in</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  // Write HTML files
  const printHtmlPath = path.join(outputDir, 'disruptors-convention-registration-sign-print.html');
  const darkHtmlPath = path.join(outputDir, 'disruptors-convention-registration-sign-dark.html');
  fs.writeFileSync(printHtmlPath, printHtml);
  fs.writeFileSync(darkHtmlPath, darkHtml);

  // Render with Playwright
  console.log('Rendering perfect A4 PDF and PNG...');
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 2
  });

  // Print Edition
  await page.setContent(printHtml, { waitUntil: 'networkidle' });
  await page.pdf({
    path: path.join(outputDir, 'Disruptors_Convention_Registration_Sign_Print.pdf'),
    width: '794px',
    height: '1123px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  await page.screenshot({
    path: path.join(outputDir, 'Disruptors_Convention_Registration_Sign_Print.png'),
    clip: { x: 0, y: 0, width: 794, height: 1123 }
  });

  // Dark Edition
  await page.setContent(darkHtml, { waitUntil: 'networkidle' });
  await page.pdf({
    path: path.join(outputDir, 'Disruptors_Convention_Registration_Sign_Dark.pdf'),
    width: '794px',
    height: '1123px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  await page.screenshot({
    path: path.join(outputDir, 'Disruptors_Convention_Registration_Sign_Dark.png'),
    clip: { x: 0, y: 0, width: 794, height: 1123 }
  });

  await browser.close();
  console.log('Finished rendering.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
