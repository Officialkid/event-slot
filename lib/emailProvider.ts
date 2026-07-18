export type EmailProviderRuntimeEnv = {
  EMAIL_PROVIDER?: string
  SMTP_HOST?: string
  SMTP_PORT?: string
  SMTP_USER?: string
  SMTP_PASSWORD?: string
  SMTP_FROM?: string
  RESEND_FROM?: string
}

export const DEFAULT_RESEND_SENDER = "EventSlot <hello@eventsslot.com>"

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
  return provider === "smtp" || (!provider && smtpIsConfiguredFromEnv(runtimeEnv))
}

export function getConfiguredEmailFrom(runtimeEnv: EmailProviderRuntimeEnv, fallback = DEFAULT_RESEND_SENDER) {
  return readEnvValue(runtimeEnv.SMTP_FROM) || readEnvValue(runtimeEnv.RESEND_FROM) || fallback
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
  fallback = DEFAULT_RESEND_SENDER,
}: {
  runtimeEnv: EmailProviderRuntimeEnv
  preferredFrom?: string
  fallback?: string
}) {
  const configuredFrom = getConfiguredEmailFrom(runtimeEnv, fallback)
  const verifiedAddress = extractEmailAddress(configuredFrom)
  const preferredName = preferredFrom ? extractDisplayName(preferredFrom) : null
  const fallbackName = extractDisplayName(configuredFrom) ?? "EventSlot"
  const displayName = preferredName || fallbackName
  return `${displayName} <${verifiedAddress}>`
}
