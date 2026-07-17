import {
  DEFAULT_RESEND_SENDER,
  extractDisplayName,
  extractEmailAddress,
  getConfiguredEmailFrom,
  getVerifiedSender,
  shouldUseSmtpFromEnv,
  smtpIsConfiguredFromEnv,
  type EmailProviderRuntimeEnv,
} from "@/lib/emailProvider"

const smtpEnv: EmailProviderRuntimeEnv = {
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_USER: "smtp-user",
  SMTP_PASSWORD: "smtp-password",
  SMTP_FROM: "EventSlot <hello@eventsslot.com>",
}

describe("emailProvider", () => {
  it("detects a complete SMTP configuration", () => {
    expect(smtpIsConfiguredFromEnv(smtpEnv)).toBe(true)
    expect(smtpIsConfiguredFromEnv({ ...smtpEnv, SMTP_PASSWORD: "" })).toBe(false)
    expect(smtpIsConfiguredFromEnv({ ...smtpEnv, SMTP_HOST: "   " })).toBe(false)
  })

  it("uses SMTP when explicitly requested or when SMTP secrets are complete", () => {
    expect(shouldUseSmtpFromEnv({ ...smtpEnv, EMAIL_PROVIDER: "smtp" })).toBe(true)
    expect(shouldUseSmtpFromEnv({ ...smtpEnv, EMAIL_PROVIDER: " SMTP " })).toBe(true)
    expect(shouldUseSmtpFromEnv(smtpEnv)).toBe(true)
  })

  it("keeps explicit non-SMTP providers on the fallback provider", () => {
    expect(shouldUseSmtpFromEnv({ ...smtpEnv, EMAIL_PROVIDER: "resend" })).toBe(false)
    expect(shouldUseSmtpFromEnv({ EMAIL_PROVIDER: "resend" })).toBe(false)
  })

  it("normalizes configured sender addresses", () => {
    expect(getConfiguredEmailFrom(smtpEnv)).toBe("EventSlot <hello@eventsslot.com>")
    expect(getConfiguredEmailFrom({ RESEND_FROM: "EventSlot <noreply@eventsslot.com>" })).toBe("EventSlot <noreply@eventsslot.com>")
    expect(getConfiguredEmailFrom({})).toBe(DEFAULT_RESEND_SENDER)
    expect(extractEmailAddress("EventSlot <hello@eventsslot.com>")).toBe("hello@eventsslot.com")
    expect(extractDisplayName('"EventSlot Team" <hello@eventsslot.com>')).toBe("EventSlot Team")
  })

  it("keeps caller branding while forcing the configured sender address", () => {
    expect(
      getVerifiedSender({
        runtimeEnv: smtpEnv,
        preferredFrom: "Christhood Potluck <events@another-domain.test>",
      }),
    ).toBe("Christhood Potluck <hello@eventsslot.com>")

    expect(getVerifiedSender({ runtimeEnv: smtpEnv })).toBe("EventSlot <hello@eventsslot.com>")
  })
})
