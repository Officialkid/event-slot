import crypto from 'crypto'

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex')
}
