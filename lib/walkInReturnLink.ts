import { createHmac, timingSafeEqual } from "node:crypto"
import { env } from "@/lib/env"

export type WalkInReturnLinkPayload = {
  slug: string
  name: string
  phone: string
}

function getReturnLinkSecret() {
  return env.NEXTAUTH_SECRET || env.QR_SECRET || "eventslot-walkin-return-link-secret"
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function signPayload(payloadJson: string) {
  return createHmac("sha256", getReturnLinkSecret()).update(payloadJson).digest("base64url")
}

export function createWalkInReturnToken(payload: WalkInReturnLinkPayload) {
  const payloadJson = JSON.stringify(payload)
  return `${base64UrlEncode(payloadJson)}.${signPayload(payloadJson)}`
}

export function verifyWalkInReturnToken(token: string | null | undefined): WalkInReturnLinkPayload | null {
  if (!token) return null

  const parts = token.split(".")
  if (parts.length !== 2) return null

  const [encodedPayload, signature] = parts
  if (!encodedPayload || !signature) return null

  let payloadJson = ""
  try {
    payloadJson = base64UrlDecode(encodedPayload)
  } catch {
    return null
  }

  const expectedSignature = signPayload(payloadJson)
  const expectedBuffer = Buffer.from(expectedSignature, "utf8")
  const receivedBuffer = Buffer.from(signature, "utf8")
  if (expectedBuffer.length !== receivedBuffer.length) return null
  if (!timingSafeEqual(expectedBuffer, receivedBuffer)) return null

  try {
    const parsed = JSON.parse(payloadJson) as Partial<WalkInReturnLinkPayload>
    if (
      typeof parsed.slug !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.phone !== "string" ||
      !parsed.slug.trim() ||
      !parsed.name.trim() ||
      !parsed.phone.trim()
    ) {
      return null
    }

    return {
      slug: parsed.slug.trim(),
      name: parsed.name.trim(),
      phone: parsed.phone.trim(),
    }
  } catch {
    return null
  }
}

export function buildWalkInReturnLink(origin: string, slug: string, token: string) {
  return `${origin.replace(/\/$/, "")}/walkin/${encodeURIComponent(slug)}?recheck=${encodeURIComponent(token)}`
}
