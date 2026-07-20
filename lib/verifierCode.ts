import { randomBytes } from "crypto"

export function generateVerifierCode() {
  return `EV-${randomBytes(4).toString("hex").toUpperCase()}`
}

export function normalizeVerifierCode(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
}
