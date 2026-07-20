type HumanVerificationResult = {
  ok: boolean
  skipped?: boolean
  error?: string
}

export async function verifyHumanChallenge(token: string | null | undefined, remoteIp?: string | null): Promise<HumanVerificationResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim() || process.env.TURNSTILE_SECRET_KEY?.trim()

  if (!secret) {
    return { ok: true, skipped: true }
  }

  if (!token?.trim()) {
    return { ok: false, error: "Human verification is required." }
  }

  const endpoint = process.env.TURNSTILE_SECRET_KEY?.trim()
    ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    : "https://www.google.com/recaptcha/api/siteverify"

  const body = new URLSearchParams()
  body.set("secret", secret)
  body.set("response", token.trim())
  if (remoteIp) body.set("remoteip", remoteIp)

  try {
    const res = await fetch(endpoint, { method: "POST", body })
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] }
    if (data.success) return { ok: true }
    return { ok: false, error: "Human verification failed. Please try again." }
  } catch {
    return { ok: false, error: "Could not verify the human check right now." }
  }
}
