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
    '<div style="text-align:center;margin:20px 0;"><img src="$2" alt="$1" style="max-width:100%;height:auto;border-radius:12px;border:1px solid #2A2A2A;display:block;margin:0 auto;" /></div>'
  )

  // 2. Bold: **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FFFFFF;">$1</strong>')

  // 3. Italic: *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em style="color:#E5E5E5;">$1</em>')

  // 4. Markdown links: [text](url)
  formatted = formatted.replace(
    /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#C8F55A;text-decoration:underline;font-weight:500;">$1</a>'
  )

  // 5. Raw URLs (not inside tags or already linked)
  formatted = formatted.replace(
    /(^|[^"'>])(https?:\/\/[^\s<)]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#C8F55A;text-decoration:underline;">$2</a>'
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
        return `<ul style="margin:0 0 16px;padding-left:24px;color:#D4D4D4;line-height:1.6;">${items
          .map((item) => `<li style="margin-bottom:6px;">${item}</li>`)
          .join("")}</ul>`
      }
      return `<p style="margin:0 0 16px;line-height:1.65;color:#D4D4D4;font-size:15px;">${trimmed.replace(
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
<body style="margin:0;padding:0;background:#0A0A0A;color:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:580px;margin:0 auto;padding:32px 16px;">

    ${
      preheader
        ? `
    <!-- Preheader Top Hook -->
    <div style="text-align:center;margin-bottom:20px;padding:8px 12px;background:rgba(200,245,90,0.06);border:1px solid rgba(200,245,90,0.2);border-radius:8px;">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#C8F55A;">
        ${preheader}
      </p>
    </div>
    `
        : ""
    }

    <!-- Brand Header -->
    <div style="margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.03em;">
        <span style="color:#FFFFFF;">Event</span><span style="color:#C8F55A;">Slot</span>
      </div>
    </div>

    <!-- Main Card -->
    <div style="background:#141414;border:1px solid #262626;border-radius:18px;overflow:hidden;padding:${
      isHeroLayout ? "0 0 32px 0" : "32px"
    };box-shadow:0 12px 36px rgba(0,0,0,0.6);">

      ${
        isHeroLayout && bannerUrl
          ? `
      <!-- Hero Banner / Event Poster -->
      <div style="width:100%;margin:0;background:#000;text-align:center;">
        <img src="${bannerUrl}" alt="${subject}" style="width:100%;max-width:100%;height:auto;display:block;border-bottom:1px solid #262626;" />
      </div>
      `
          : ""
      }

      <div style="${isHeroLayout && bannerUrl ? "padding:28px 28px 0 28px;" : ""}">

        ${
          hasEventChips
            ? `
        <!-- Event Details Chips Bar -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#1A1A1A;border:1px solid #2F2F2F;border-radius:12px;">
          <tr>
            ${
              eventDateLabel
                ? `
            <td style="padding:14px 16px;text-align:center;border-right:1px solid #2A2A2A;">
              <span style="font-size:10px;text-transform:uppercase;color:#888;font-weight:600;display:block;margin-bottom:4px;">Date</span>
              <strong style="color:#FFF;font-size:13px;">${eventDateLabel}</strong>
            </td>`
                : ""
            }
            ${
              eventLocation
                ? `
            <td style="padding:14px 16px;text-align:center;${
              eventBadge ? "border-right:1px solid #2A2A2A;" : ""
            }">
              <span style="font-size:10px;text-transform:uppercase;color:#888;font-weight:600;display:block;margin-bottom:4px;">Location</span>
              <strong style="color:#FFF;font-size:13px;">${eventLocation}</strong>
            </td>`
                : ""
            }
            ${
              eventBadge
                ? `
            <td style="padding:14px 16px;text-align:center;">
              <span style="font-size:10px;text-transform:uppercase;color:#888;font-weight:600;display:block;margin-bottom:4px;">Highlights</span>
              <strong style="color:#C8F55A;font-size:13px;">${eventBadge}</strong>
            </td>`
                : ""
            }
          </tr>
        </table>
        `
            : ""
        }

        <!-- Body Content -->
        <div style="font-size:15px;line-height:1.65;color:#D4D4D4;">
          ${bodyHtml}
        </div>

        ${
          hasCta
            ? `
        <!-- Primary Action Button -->
        <div style="text-align:center;margin:32px 0 16px;">
          <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;background:#C8F55A;color:#0A0A0A;font-weight:700;font-size:15px;padding:15px 36px;border-radius:12px;text-decoration:none;box-shadow:0 6px 20px rgba(200,245,90,0.3);letter-spacing:-0.01em;">
            ${ctaText}
          </a>
        </div>
        `
            : ""
        }

      </div>

    </div>

    <!-- Footer & Unsubscribe -->
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #222;text-align:center;">
      <p style="color:#737373;font-size:12px;margin:0 0 6px;">
        Smarter Events. Better Experiences.
      </p>
      <p style="color:#525252;font-size:11px;margin:0;line-height:1.5;">
        You received this email because you have an EventSlot account.
        <br/>
        <a href="${unsubscribeUrl}" style="color:#737373;text-decoration:underline;">
          Unsubscribe from marketing emails
        </a>
      </p>
    </div>

  </div>
</body>
</html>
`
}
