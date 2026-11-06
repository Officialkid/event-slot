import crypto from "crypto"
import type { PrismaClient } from "@prisma/client"

export const REFERENCE_CODE_PREFIX = "ES-CARE-"
export const SAFE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

export function generateReferenceCodeCandidate(): string {
  const bytes = crypto.randomBytes(8)
  let result = ""
  for (let i = 0; i < 8; i++) {
    result += SAFE_CHARSET[bytes[i] % SAFE_CHARSET.length]
  }
  return `${REFERENCE_CODE_PREFIX}${result}`
}

/**
 * Generates a guaranteed unique cryptographic reference code for a job application.
 * Retries automatically up to 5 times in the unlikely event of an initial collision.
 */
export async function generateUniqueReferenceCode(
  prismaClient: PrismaClient
): Promise<string> {
  const maxAttempts = 5

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateReferenceCodeCandidate()
    const existing = await prismaClient.jobApplication.findUnique({
      where: { referenceCode: candidate },
      select: { id: true },
    })

    if (!existing) {
      return candidate
    }
  }

  // Fallback with timestamp salt if multiple collisions occur
  const timestampSalt = Date.now().toString(36).toUpperCase().slice(-4)
  const randomSuffix = crypto.randomBytes(2).toString("hex").toUpperCase()
  return `ES-CARE-${timestampSalt}${randomSuffix}`
}
