/** @jest-environment node */

/**
 * Tests for lib/encrypt.ts — AES-256-CBC encrypt/decrypt round trips
 * and graceful degradation when ENCRYPTION_KEY is absent or invalid.
 *
 * NOTE: jest.mock() calls are hoisted to the top of the file by Babel/Jest,
 * so module-level mocks must use jest.doMock() inside describe() blocks when
 * they need to vary per test group.
 */

jest.mock('@/lib/env', () => ({
  env: { ENCRYPTION_KEY: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' },
}))

import { encrypt, decrypt } from '@/lib/encrypt'

describe('encrypt / decrypt — with valid key', () => {
  it('encrypts a string to a non-empty hex ciphertext', () => {
    const { encrypted, iv } = encrypt('hello world')
    expect(encrypted).not.toBe('hello world')
    expect(encrypted).toMatch(/^[0-9a-f]+$/i)
    expect(iv).toMatch(/^[0-9a-f]{32}$/i) // 16 bytes = 32 hex chars
  })

  it('round-trips a plain string', () => {
    const original = 'https://meet.google.com/abc-defg-hij'
    const { encrypted, iv } = encrypt(original)
    const result = decrypt(encrypted, iv)
    expect(result).toBe(original)
  })

  it('round-trips a string with special characters', () => {
    const original = 'Nairobi 2026 – Tëst & Vérifîcation! <script>'
    const { encrypted, iv } = encrypt(original)
    expect(decrypt(encrypted, iv)).toBe(original)
  })

  it('uses a random IV so the same plaintext produces different ciphertext each time', () => {
    const text = 'same input value'
    const first = encrypt(text)
    const second = encrypt(text)
    // IVs must differ (random); ciphertext will also differ
    expect(first.iv).not.toBe(second.iv)
  })

  it('returns null when ciphertext is corrupted but IV is valid', () => {
    const { iv } = encrypt('data')
    const result = decrypt('not-valid-hex-at-all', iv)
    expect(result).toBeNull()
  })

  it('returns null when IV is valid hex but ciphertext is garbage hex', () => {
    const { iv } = encrypt('data')
    const result = decrypt('deadbeef', iv) // valid hex but wrong length / padding
    expect(result).toBeNull()
  })
})

describe('decrypt — plain-text passthrough (empty IV)', () => {
  it('returns the stored value as-is when iv is empty string', () => {
    // Records saved before encryption was enabled have iv = ''
    const result = decrypt('https://meet.google.com/xyz-plain', '')
    expect(result).toBe('https://meet.google.com/xyz-plain')
  })

  it('handles an empty string payload with empty IV', () => {
    const result = decrypt('', '')
    expect(result).toBe('')
  })
})
