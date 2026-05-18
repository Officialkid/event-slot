import { createHmac } from "crypto"

function getQrSecret(): string {
  const secret = process.env.QR_SECRET
  if (!secret) {
    throw new Error("QR_SECRET is not configured")
  }
  return secret
}

// Generate signed QR payload: ticketId:eventId:userId:signature
export function generateQRPayload(ticketId: string, eventId: string, userId: string): string {
  const data = `${ticketId}:${eventId}:${userId}`
  const signature = createHmac("sha256", getQrSecret())
    .update(data)
    .digest("hex")
    .substring(0, 16)

  return `${data}:${signature}`
}

// Verify scanned QR payload and recover components.
export function verifyQRPayload(payload: string): {
  valid: boolean
  ticketId: string | null
  eventId: string | null
  userId: string | null
} {
  try {
    const parts = payload.split(":")
    if (parts.length !== 4) {
      return { valid: false, ticketId: null, eventId: null, userId: null }
    }

    const [ticketId, eventId, userId, signature] = parts
    const data = `${ticketId}:${eventId}:${userId}`
    const expected = createHmac("sha256", getQrSecret())
      .update(data)
      .digest("hex")
      .substring(0, 16)

    if (signature !== expected) {
      return { valid: false, ticketId: null, eventId: null, userId: null }
    }

    return { valid: true, ticketId, eventId, userId }
  } catch {
    return { valid: false, ticketId: null, eventId: null, userId: null }
  }
}
