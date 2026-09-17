const fs = require('fs');
const path = require('path');
const nodemailer = require(path.join(process.cwd(), 'node_modules', 'nodemailer'));

let envContent = '';
try {
  envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
} catch (_) {}

function getEnvVal(key) {
  if (process.env[key]) return process.env[key].trim();
  const match = envContent.match(new RegExp(`${key}=["']?([^"'\\r\\n]+)`));
  return match ? match[1].trim() : '';
}

const apiKey = getEnvVal('RESEND_API_KEY');
const smtpHost = getEnvVal('SMTP_HOST');
const smtpPort = getEnvVal('SMTP_PORT') || '465';
const smtpSecure = getEnvVal('SMTP_SECURE') || 'true';
const smtpUser = getEnvVal('SMTP_USER');
const smtpPass = getEnvVal('SMTP_PASSWORD');
const smtpFrom = getEnvVal('SMTP_FROM') || 'EventSlot <hello@eventsslot.com>';

let resend = null;
if (apiKey) {
  const { Resend } = require(path.join(process.cwd(), 'node_modules', 'resend'));
  resend = new Resend(apiKey);
}

let smtpTransporter = null;
if (smtpHost && smtpUser && smtpPass) {
  smtpTransporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    host: smtpHost,
    port: Number(smtpPort),
    secure: smtpSecure === 'true' || Number(smtpPort) === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

if (!smtpTransporter && !resend) {
  console.error('Neither SMTP credentials nor RESEND_API_KEY found.');
  process.exit(1);
}

const { PrismaClient } = require(path.join(process.cwd(), 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();

function sanitizeName(rawName) {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';
  if (trimmed.includes('@') || (/^[a-z0-9._%+-]+$/i.test(trimmed) && trimmed.length > 15)) {
    return '';
  }
  const first = trimmed.split(/\s+/)[0];
  if (!first || first.length < 2) return '';
  if (/^kid$/i.test(first) || /^officialkid$/i.test(first)) return '';
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function buildFeedbackEmailHtml(name = '') {
  const cleanFirst = sanitizeName(name);
  const greeting = cleanFirst ? `Hey ${cleanFirst}! 👋` : 'Hey everyone! 👋';
  const formUrl = 'https://forms.gle/3gqvGTP7kH4G4GZ86';

  return `
    <div style="background:#0A0A0A;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#FAFAF7;line-height:1.6;">
      <div style="max-width:540px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:16px;padding:36px 32px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
        
        <!-- Logo -->
        <div style="margin-bottom:28px;">
          <span style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.03em;">Event</span><span style="font-size:22px;font-weight:800;color:#C8F55A;letter-spacing:-0.03em;">Slot</span>
        </div>

        <!-- Greeting -->
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0 0 16px;line-height:1.3;">
          ${greeting}
        </h1>

        <!-- Body -->
        <p style="color:#D4D4D4;font-size:15px;margin:0 0 16px;line-height:1.6;">
          We’ve been building and improving EventSlot, and now we want to hear directly from <strong style="color:#FFFFFF;">YOU</strong>.
        </p>

        <!-- Question Callout -->
        <div style="background:rgba(200,245,90,0.06);border-left:3px solid #C8F55A;border-radius:6px;padding:14px 18px;margin:20px 0;">
          <p style="color:#E5E5E5;font-size:14px;font-style:italic;margin:0;line-height:1.5;">
            How has your experience been so far? What do you love? What frustrates you? What should we improve?
          </p>
        </div>

        <p style="color:#D4D4D4;font-size:15px;margin:0 0 16px;line-height:1.6;">
          We’ve created a very short feedback form that takes <strong>less than 2 minutes</strong> to complete.
        </p>

        <p style="color:#D4D4D4;font-size:15px;margin:0 0 24px;line-height:1.6;">
          Your honest feedback will directly help us shape the next version of EventSlot and build a platform that truly solves your needs.
        </p>

        <!-- CTA Button -->
        <div style="text-align:center;margin:30px 0 24px;">
          <a href="${formUrl}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;background:#C8F55A;color:#0A0A0A;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;box-shadow:0 4px 16px rgba(200,245,90,0.35);">
            Take 2-Minute Feedback Form →
          </a>
        </div>

        <p style="color:#8C8C8C;font-size:13px;text-align:center;margin:0 0 28px;">
          Or copy this link: <a href="${formUrl}" style="color:#C8F55A;text-decoration:underline;">${formUrl}</a>
        </p>

        <!-- Sign-off -->
        <div style="border-top:1px solid #262626;padding-top:20px;margin-top:20px;">
          <p style="color:#A3A3A3;font-size:13px;margin:0 0 4px;font-style:italic;">
            Smarter Events. Better Experiences.
          </p>
          <p style="color:#FFFFFF;font-size:14px;font-weight:600;margin:0;">
            — Team EventSlot
          </p>
        </div>

      </div>

      <div style="text-align:center;max-width:540px;margin:20px auto 0;">
        <p style="color:#525252;font-size:11px;margin:0;">
          Sent by EventSlot · <a href="https://eventsslot.com" style="color:#737373;text-decoration:none;">eventsslot.com</a>
        </p>
      </div>
    </div>
  `;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('--- EventSlot Community Feedback Broadcast ---');
  if (isDryRun) {
    console.log('MODE: DRY RUN (no emails will be sent)');
  }

  // 1. Gather audience
  const users = await prisma.user.findMany({
    select: { email: true, name: true, suspended: true }
  });

  const regs = await prisma.registration.findMany({
    where: { attendeeEmail: { not: null } },
    select: { attendeeEmail: true }
  });

  const audience = new Map();

  for (const u of users) {
    if (u.suspended) continue;
    if (u.email && !u.email.includes('test') && !u.email.includes('archived') && u.email.includes('@')) {
      audience.set(u.email.toLowerCase().trim(), u.name || '');
    }
  }

  for (const r of regs) {
    if (r.attendeeEmail && !r.attendeeEmail.includes('test') && r.attendeeEmail.includes('@')) {
      const email = r.attendeeEmail.toLowerCase().trim();
      if (!audience.has(email)) {
        audience.set(email, '');
      }
    }
  }

  console.log(`Audience count: ${audience.size} unique recipients`);

  if (isDryRun) {
    console.log('Sample recipients:', Array.from(audience.entries()).slice(0, 10));
    return;
  }

  let sentCount = 0;
  let errorCount = 0;

  for (const [email, name] of audience.entries()) {
    let sent = false;
    const emailHtml = buildFeedbackEmailHtml(name);
    const subject = 'Quick 2-minute feedback — Help shape the next EventSlot';

    if (smtpTransporter) {
      try {
        await smtpTransporter.sendMail({
          from: smtpFrom,
          to: email,
          subject,
          html: emailHtml,
        });
        sent = true;
        sentCount++;
      } catch (smtpErr) {
        console.warn(`[broadcast] SMTP send error for ${email}: ${smtpErr.message}. Attempting Resend fallback...`);
      }
    }

    if (!sent && resend) {
      try {
        await resend.emails.send({
          from: 'EventSlot <hello@eventsslot.com>',
          to: email,
          subject,
          html: emailHtml,
        });
        sent = true;
        sentCount++;
      } catch (resendErr) {
        console.error(`[broadcast] Resend fallback failed for ${email}:`, resendErr.message || resendErr);
      }
    }

    if (sent) {
      if (sentCount % 10 === 0 || sentCount === audience.size) {
        console.log(`[${sentCount}/${audience.size}] Sent feedback survey email to ${email}`);
      }
      // Paced delay (350ms) to avoid network congestion
      await sleep(350);
    } else {
      errorCount++;
      await sleep(1000);
    }
  }

  console.log(`\nBroadcast complete! Successfully sent: ${sentCount}, Errors: ${errorCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
