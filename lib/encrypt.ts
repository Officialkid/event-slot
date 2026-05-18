import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-cbc"

function getSecretKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY

  if (!keyHex) {
    throw new Error("ENCRYPTION_KEY is not configured")
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
  }

  return Buffer.from(keyHex, "hex")
}

// Encrypt a string - returns encrypted payload and initialization vector.
export function encrypt(text: string): { encrypted: string; iv: string } {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, getSecretKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])

  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
  }
}

// Decrypt an encrypted payload using the original IV.
export function decrypt(encrypted: string, iv: string): string {
  const decipher = createDecipheriv(ALGORITHM, getSecretKey(), Buffer.from(iv, "hex"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "hex")),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}
