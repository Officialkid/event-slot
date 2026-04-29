export function normalizeCommunityLink(input: unknown): string | null {
  if (typeof input !== "string") return null

  const trimmed = input.trim().replace(/^['"]|['"]$/g, "")
  if (!trimmed) return null

  let candidate = trimmed
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate)

  if (!hasScheme) {
    candidate = candidate.startsWith("//") ? `https:${candidate}` : `https://${candidate}`
  }

  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

export function getCommunityLinkLabel(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes("whatsapp") || lower.includes("wa.me")) return "Join WhatsApp Group ->"
  if (lower.includes("t.me") || lower.includes("telegram")) return "Join Telegram Group ->"
  return url
}