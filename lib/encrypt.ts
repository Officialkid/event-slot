import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-cbc"

function getSecretKey(): Buffer | null {
  const keyHex = process.env.ENCRYPTION_KEY

  if (!keyHex) {
    return null
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    console.error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes) — encryption disabled")
    return null
  }

  return Buffer.from(keyHex, "hex")
}

// Encrypt a string - returns encrypted payload and initialization vector.
// If ENCRYPTION_KEY is not configured, returns the plain text with an empty iv (graceful degradation).
export function encrypt(text: string): { encrypted: string; iv: string } {
  const key = getSecretKey()

  if (!key) {
    console.error("ENCRYPTION_KEY not set — storing virtual link in plain text")
    return { encrypted: text, iv: "" }
  }

  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])

  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
  }
}

// Decrypt an encrypted payload using the original IV.
// If iv is empty the value was stored as plain text — return as-is.
// If ENCRYPTION_KEY is not configured, return the stored value as-is.
export function decrypt(encrypted: string, iv: string): string {
  if (!iv) {
    // Plain-text passthrough (stored without encryption)
    return encrypted
  }

  const key = getSecretKey()

  if (!key) {
    console.error("ENCRYPTION_KEY not set — returning stored value as-is")
    return encrypted
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "hex")),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}
