import { APP_URL } from "@/lib/config"

export type BroadcastLayoutType = "PROMOTIONAL_HERO" | "TEXT_MINIMAL"

export type BroadcastTemplateOptions = {
  layoutType?: BroadcastLayoutType
  subject: string
  preheader?: string | null
  bannerUrl?: string | null
  content: string
  ctaText?: string | null
  ctaUrl?: string | null
  eventDateLabel?: string | null
  eventLocation?: string | null
  eventBadge?: string | null
  recipientName?: string | null
  userId?: string | null
}

function sanitizeName(rawName: string | null | undefined): string {
  if (!rawName) return "there"
  const trimmed = rawName.trim()
  if (!trimmed) return "there"
  if (trimmed.includes("@") || (/^[a-z0-9._%+-]+$/i.test(trimmed) && trimmed.length > 15)) {
    return "there"
  }
  const first = trimmed.split(/\s+/)[0]
  if (!first || first.length < 2) return "there"
  if (/^kid$/i.test(first) || /^officialkid$/i.test(first)) return "there"
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function formatMarkdownBody(content: string): string {
  if (!content) return ""

  // If content already contains complete HTML paragraphs, return as-is
  if (/<(p|div|section|table)[^>]*>/i.test(content)) {
    return content
  }

  let formatted = content

  // 1. Markdown Images: ![alt](url)
  formatted = formatted.replace(
    /!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g,
    '<div style="text-align:center;margin:24px 0;"><img src="$2" alt="$1" style="max-width:100%;height:auto;border-radius:12px;border:1px solid #E5E7EB;display:block;margin:0 auto;" /></div>'
  )

  // 2. Bold: **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#111827;font-weight:700;">$1</strong>')

  // 3. Italic: *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em style="color:#4B5563;">$1</em>')

  // 4. Markdown links: [text](url)
  formatted = formatted.replace(
    /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#15803d;text-decoration:underline;font-weight:600;">$1</a>'
  )

  // 5. Raw URLs (not inside tags or already linked)
  formatted = formatted.replace(
    /(^|[^"'>])(https?:\/\/[^\s<)]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#15803d;text-decoration:underline;font-weight:600;">$2</a>'
  )

  // 6. Split paragraphs by blank lines
  const paragraphs = formatted.split(/\n\s*\n/)
  return paragraphs
    .map((p) => {
      const trimmed = p.trim()
      if (!trimmed) return ""
      // If it looks like a list item
      if (/^[•*-]\s+/.test(trimmed)) {
        const items = trimmed
          .split(/\n/)
          .map((line) => line.replace(/^[•*-]\s+/, "").trim())
          .filter(Boolean)
        return `<ul style="margin:0 0 20px;padding-left:20px;color:#374151;line-height:1.68;">${items
          .map((item) => `<li style="margin-bottom:8px;font-size:15px;">${item}</li>`)
          .join("")}</ul>`
      }
      return `<p style="margin:0 0 18px;line-height:1.68;color:#374151;font-size:15px;">${trimmed.replace(
        /\n/g,
        "<br/>"
      )}</p>`
    })
    .join("")
}

export function renderBroadcastEmail(options: BroadcastTemplateOptions): string {
  const {
    layoutType = "PROMOTIONAL_HERO",
    subject,
    preheader,
    bannerUrl,
    content,
    ctaText,
    ctaUrl,
    eventDateLabel,
    eventLocation,
    eventBadge,
    recipientName,
    userId,
  } = options

  const cleanName = sanitizeName(recipientName)
  const personalizedContent = content
    .replace(/\{\{\s*name\s*\}\}/gi, cleanName)
    .replace(/\{\{\s*first[_\s-]?name\s*\}\}/gi, cleanName)

  const bodyHtml = formatMarkdownBody(personalizedContent)
  const unsubscribeUrl = userId
    ? `${APP_URL}/api/email/unsubscribe?id=${userId}`
    : `${APP_URL}/api/email/unsubscribe`

  const isHeroLayout = layoutType === "PROMOTIONAL_HERO"
  const hasEventChips = Boolean(eventDateLabel || eventLocation || eventBadge)
  const hasCta = Boolean(ctaText && ctaUrl)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:#F8F9FA;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:580px;margin:0 auto;padding:32px 16px;">

    <!-- Brand Header (Paystack Inspired) -->
    <div style="margin-bottom:28px;text-align:left;">
      <a href="https://www.eventsslot.com" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
        <span style="font-size:26px;font-weight:800;color:#111827;letter-spacing:-0.03em;">Event<span style="color:#15803d;">Slot</span></span>
      </a>
    </div>

    ${
      preheader
        ? `
    <!-- Preheader Top Callout -->
    <div style="text-align:left;margin-bottom:20px;padding:10px 14px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#15803d;">
        ${preheader}
      </p>
    </div>
    `
        : ""
    }

    <!-- Main Card -->
    <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;padding:${
      isHeroLayout ? "0 0 32px 0" : "32px 28px"
    };box-shadow:0 4px 20px rgba(0,0,0,0.03);">

      ${
        isHeroLayout && bannerUrl
          ? `
      <!-- Hero Banner / Event Poster -->
      <div style="width:100%;margin:0;background:#F9FAFB;text-align:center;">
        <img src="${bannerUrl}" alt="${subject}" style="width:100%;max-width:100%;height:auto;display:block;border-bottom:1px solid #E5E7EB;" />
      </div>
      `
          : ""
      }

      <div style="${isHeroLayout && bannerUrl ? "padding:28px 28px 0 28px;" : ""}">

        ${
          hasEventChips
            ? `
        <!-- Event Details Chips Bar -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;">
          <tr>
            ${
              eventDateLabel
                ? `
            <td style="padding:14px 16px;text-align:center;border-right:1px solid #E5E7EB;">
              <span style="font-size:10px;text-transform:uppercase;color:#6B7280;font-weight:600;display:block;margin-bottom:4px;">Date</span>
              <strong style="color:#111827;font-size:13px;">${eventDateLabel}</strong>
            </td>`
                : ""
            }
            ${
              eventLocation
                ? `
            <td style="padding:14px 16px;text-align:center;${
              eventBadge ? "border-right:1px solid #E5E7EB;" : ""
            }">
              <span style="font-size:10px;text-transform:uppercase;color:#6B7280;font-weight:600;display:block;margin-bottom:4px;">Location</span>
              <strong style="color:#111827;font-size:13px;">${eventLocation}</strong>
            </td>`
                : ""
            }
            ${
              eventBadge
                ? `
            <td style="padding:14px 16px;text-align:center;">
              <span style="font-size:10px;text-transform:uppercase;color:#6B7280;font-weight:600;display:block;margin-bottom:4px;">Highlights</span>
              <strong style="color:#15803d;font-size:13px;">${eventBadge}</strong>
            </td>`
                : ""
            }
          </tr>
        </table>
        `
            : ""
        }

        <!-- Body Content -->
        <div style="font-size:15px;line-height:1.68;color:#374151;">
          ${bodyHtml}
        </div>

        ${
          hasCta
            ? `
        <!-- Primary Action Button -->
        <div style="text-align:left;margin:32px 0 16px;">
          <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;background:#15803d;color:#FFFFFF;font-weight:700;font-size:15px;padding:14px 32px;border-radius:999px;text-decoration:none;box-shadow:0 4px 14px rgba(21,128,61,0.25);letter-spacing:-0.01em;">
            ${ctaText} &rarr;
          </a>
        </div>
        `
            : ""
        }

        <!-- Friendly Sign-off -->
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #F3F4F6;color:#111827;font-size:15px;line-height:1.6;">
          <p style="margin:0;">Warm regards,<br/><strong>Daniel and the EventSlot Team</strong> 💙</p>
        </div>

      </div>

    </div>

    <!-- Paystack-Inspired Compliance & Branding Footer -->
    <div style="margin-top:36px;padding-top:24px;border-top:1px solid #E5E7EB;text-align:left;font-size:12px;line-height:1.6;color:#6B7280;">
      <p style="margin:0 0 10px;">
        To make sure you keep getting these emails, please add <a href="mailto:hello@eventsslot.com" style="color:#15803d;text-decoration:none;font-weight:600;">hello@eventsslot.com</a> to your address book or allow list.
      </p>
      <p style="margin:0 0 14px;">
        Want to control the kind of emails you receive from EventSlot? <a href="${APP_URL}/settings/notifications" style="color:#15803d;text-decoration:underline;">Update your email preferences</a>. Want out of the loop? <a href="${unsubscribeUrl}" style="color:#6B7280;text-decoration:underline;">Unsubscribe</a>.
      </p>
      <p style="margin:0 0 8px;color:#9CA3AF;font-size:11px;">
        The Pavilion, Westlands, Nairobi, Kenya
      </p>
      <p style="margin:0;color:#6B7280;font-size:11px;font-weight:600;">
        Powered by <a href="https://www.eventsslot.com" target="_blank" rel="noopener noreferrer" style="color:#15803d;font-weight:700;text-decoration:none;">EventSlot</a> &bull; <a href="https://www.eventsslot.com" target="_blank" rel="noopener noreferrer" style="color:#15803d;text-decoration:underline;">www.eventsslot.com</a>
      </p>
    </div>

  </div>
</body>
</html>
`
}
