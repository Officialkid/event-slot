import {
  generateFollowerUnsubscribeToken,
  verifyFollowerUnsubscribeToken,
} from '@/lib/followerSecurity'

describe('Follower Security & Unsubscribe Token Verification', () => {
  it('generates a valid signed token and successfully verifies it', () => {
    const followerId = 'user_123'
    const organiserId = 'org_456'

    const token = generateFollowerUnsubscribeToken(followerId, organiserId)
    expect(typeof token).toBe('string')
    expect(token.includes('.')).toBe(true)

    const verified = verifyFollowerUnsubscribeToken(token)
    expect(verified).not.toBeNull()
    expect(verified?.followerId).toBe(followerId)
    expect(verified?.organiserId).toBe(organiserId)
  })

  it('rejects a tampered payload or signature', () => {
    const token = generateFollowerUnsubscribeToken('user_1', 'org_1')
    const [payload, signature] = token.split('.')

    // Tampered signature
    const tamperedSig = signature.slice(0, -2) + 'aa'
    expect(verifyFollowerUnsubscribeToken(`${payload}.${tamperedSig}`)).toBeNull()

    // Tampered payload
    const tamperedPayload = Buffer.from(JSON.stringify({ fId: 'hacker', oId: 'org_1' })).toString('base64url')
    expect(verifyFollowerUnsubscribeToken(`${tamperedPayload}.${signature}`)).toBeNull()
  })

  it('safely handles malformed token inputs', () => {
    expect(verifyFollowerUnsubscribeToken('')).toBeNull()
    expect(verifyFollowerUnsubscribeToken('not-a-token')).toBeNull()
    expect(verifyFollowerUnsubscribeToken('invalid.payload.structure')).toBeNull()
    expect(verifyFollowerUnsubscribeToken(null as any)).toBeNull()
    expect(verifyFollowerUnsubscribeToken(undefined as any)).toBeNull()
  })
})
