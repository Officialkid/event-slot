export type EmailProviderRuntimeEnv = {
  EMAIL_PROVIDER?: string
  SMTP_HOST?: string
  SMTP_PORT?: string
  SMTP_USER?: string
  SMTP_PASSWORD?: string
  SMTP_FROM?: string
  SMTP_FROM_TRANSACTIONAL?: string
  SMTP_FROM_MARKETING?: string
  RESEND_FROM?: string
  RESEND_FROM_TRANSACTIONAL?: string
  RESEND_FROM_MARKETING?: string
}

export const DEFAULT_TRANSACTIONAL_SENDER = "EventSlot Notifications <notifications@eventsslot.com>"
export const DEFAULT_MARKETING_SENDER = "EventSlot <hello@eventsslot.com>"
export const DEFAULT_RESEND_SENDER = DEFAULT_MARKETING_SENDER

function readEnvValue(value: string | undefined) {
  return value?.trim() ?? ""
}

export function smtpIsConfiguredFromEnv(runtimeEnv: EmailProviderRuntimeEnv) {
  return Boolean(
    readEnvValue(runtimeEnv.SMTP_HOST) &&
      readEnvValue(runtimeEnv.SMTP_PORT) &&
      readEnvValue(runtimeEnv.SMTP_USER) &&
      readEnvValue(runtimeEnv.SMTP_PASSWORD),
  )
}

export function shouldUseSmtpFromEnv(runtimeEnv: EmailProviderRuntimeEnv) {
  const provider = readEnvValue(runtimeEnv.EMAIL_PROVIDER).toLowerCase()
  if (provider === "resend") return false
  return provider === "smtp" || provider === "nodemailer" || smtpIsConfiguredFromEnv(runtimeEnv)
}

export function getConfiguredEmailFrom(runtimeEnv: EmailProviderRuntimeEnv, fallback = DEFAULT_RESEND_SENDER) {
  return readEnvValue(runtimeEnv.SMTP_FROM) || readEnvValue(runtimeEnv.RESEND_FROM) || fallback
}

export function getConfiguredTransactionalFrom(
  runtimeEnv: EmailProviderRuntimeEnv,
  fallback = DEFAULT_TRANSACTIONAL_SENDER,
) {
  const specific =
    readEnvValue(runtimeEnv.SMTP_FROM_TRANSACTIONAL) ||
    readEnvValue(runtimeEnv.RESEND_FROM_TRANSACTIONAL)
  if (specific) return specific

  const generic = readEnvValue(runtimeEnv.SMTP_FROM) || readEnvValue(runtimeEnv.RESEND_FROM)
  if (generic && !generic.includes("hello@eventsslot.com")) {
    return generic
  }

  return fallback
}

export function getConfiguredMarketingFrom(
  runtimeEnv: EmailProviderRuntimeEnv,
  fallback = DEFAULT_MARKETING_SENDER,
) {
  return (
    readEnvValue(runtimeEnv.SMTP_FROM_MARKETING) ||
    readEnvValue(runtimeEnv.RESEND_FROM_MARKETING) ||
    readEnvValue(runtimeEnv.SMTP_FROM) ||
    readEnvValue(runtimeEnv.RESEND_FROM) ||
    fallback
  )
}

export function extractEmailAddress(sender: string) {
  const match = sender.match(/<([^>]+)>/)
  return (match?.[1] ?? sender).trim()
}

export function extractDisplayName(sender: string) {
  const match = sender.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/)
  return match?.[1]?.trim() ?? null
}

export function getVerifiedSender({
  runtimeEnv,
  preferredFrom,
  category,
  fallback,
}: {
  runtimeEnv: EmailProviderRuntimeEnv
  preferredFrom?: string
  category?: "transactional" | "marketing"
  fallback?: string
}) {
  if (!category) {
    const configuredFrom = getConfiguredEmailFrom(runtimeEnv, fallback || DEFAULT_RESEND_SENDER)
    const verifiedAddress = extractEmailAddress(configuredFrom)
    const preferredName = preferredFrom ? extractDisplayName(preferredFrom) : null
    const fallbackName = extractDisplayName(configuredFrom) ?? "EventSlot"
    const displayName = preferredName || fallbackName
    return `${displayName} <${verifiedAddress}>`
  }

  const defaultFallback =
    category === "marketing" ? DEFAULT_MARKETING_SENDER : DEFAULT_TRANSACTIONAL_SENDER
  const targetFallback = fallback || defaultFallback

  const configuredFrom =
    category === "marketing"
      ? getConfiguredMarketingFrom(runtimeEnv, targetFallback)
      : getConfiguredTransactionalFrom(runtimeEnv, targetFallback)

  const verifiedAddress = extractEmailAddress(configuredFrom)
  const preferredName = preferredFrom ? extractDisplayName(preferredFrom) : null
  const fallbackName =
    extractDisplayName(configuredFrom) ??
    (category === "marketing" ? "EventSlot" : "EventSlot Notifications")
  const displayName = preferredName || fallbackName
  return `${displayName} <${verifiedAddress}>`
}
