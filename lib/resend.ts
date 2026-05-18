import { Resend } from "resend"

export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured")
  }
  return new Resend(apiKey)
}

// Explicit object so no property is accessed at module-init time.
// getResendClient() is only called when emails.send() is actually invoked.
export const resend = {
  emails: {
    send: (...args: Parameters<Resend["emails"]["send"]>) =>
      getResendClient().emails.send(...args),
  },
}
