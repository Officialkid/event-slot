// Characters that are unambiguous to read aloud or transcribe (no 0/O, 1/I/L)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generates a unique confirmation code in the format EVT-XXXXXXXX
 * where X is an uppercase alphanumeric character (32 possibilities per position).
 * With 8 characters: 32^8 ≈ 1 trillion possibilities — effectively collision-free.
 */
export function generateConfirmationCode(): string {
  let suffix = ''
  for (let i = 0; i < 8; i++) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return `EVT-${suffix}`
}
