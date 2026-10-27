import crypto from 'crypto'

const SECRET = process.env.NEXTAUTH_SECRET || process.env.ENCRYPTION_KEY || 'eventslot-follower-secret-key'

interface UnsubscribePayload {
  fId: string // followerId
  oId: string // organiserId
  iat: number // issued at timestamp
}

/**
 * Generates an HMAC-signed unsubscribe token for 1-click email headers and footer links.
 */
export function generateFollowerUnsubscribeToken(followerId: string, organiserId: string): string {
  const payload: UnsubscribePayload = {
    fId: followerId,
    oId: organiserId,
    iat: Math.floor(Date.now() / 1000),
  }

  const payloadString = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(payloadString)
    .digest('base64url')

  return `${payloadString}.${signature}`
}

/**
 * Cryptographically verifies an unsubscribe token and extracts follower and organiser IDs.
 * Returns null if the signature is invalid or tampered with.
 */
export function verifyFollowerUnsubscribeToken(
  token: string
): { followerId: string; organiserId: string } | null {
  try {
    if (!token || typeof token !== 'string') return null
    const parts = token.split('.')
    if (parts.length !== 2) return null

    const [payloadString, signature] = parts
    const expectedSignature = crypto
      .createHmac('sha256', SECRET)
      .update(payloadString)
      .digest('base64url')

    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expectedSignature)

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null
    }

    const payloadJson = Buffer.from(payloadString, 'base64url').toString('utf8')
    const payload = JSON.parse(payloadJson) as UnsubscribePayload

    if (!payload.fId || !payload.oId) return null

    return {
      followerId: payload.fId,
      organiserId: payload.oId,
    }
  } catch {
    return null
  }
}
