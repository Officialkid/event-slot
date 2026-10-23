/** @jest-environment node */

import crypto from 'crypto'
import { POST as intasendPost, GET as intasendGet } from '@/app/api/payments/intasend/webhook/route'
import { verifyPaystackWebhookSignature } from '@/lib/paystack'
import { sendMpesaPayout, sendBankPayout, sendPaybillPayout } from '@/services/payouts'
import { normalizeMpesaPhone, isValidMpesaPhone } from '@/lib/phone'

// Mock Paystack payouts for unit testing
jest.mock('@/services/payouts/paystack', () => ({
  sendMpesaPayout: jest.fn().mockResolvedValue({ trackingId: 'trf_mp_mock_123', raw: {} }),
  sendBankPayout: jest.fn().mockResolvedValue({ trackingId: 'trf_bk_mock_456', raw: {} }),
  sendPaybillPayout: jest.fn().mockImplementation(() => {
    throw new Error('Paystack does not support Paybill B2B transfers in Kenya. Please select M-Pesa or Bank transfer for withdrawal.')
  }),
}))

describe('Phase 04b: Critical Payment Security Remediation & IntraSend Decommissioning', () => {
  describe('1. Legacy IntraSend Webhook Containment', () => {
    it('returns HTTP 410 Gone for arbitrary POST requests with fraudulent complete payloads', async () => {
      const res = await intasendPost()
      expect(res.status).toBe(410)

      const body = await res.json()
      expect(body.status).toBe('DECOMMISSIONED')
      expect(body.provider).toBe('intasend')
      expect(body.error).toContain('decommissioned')
    })

    it('returns HTTP 410 Gone for GET requests', async () => {
      const res = await intasendGet()
      expect(res.status).toBe(410)

      const body = await res.json()
      expect(body.status).toBe('DECOMMISSIONED')
    })
  })

  describe('2. Paystack Webhook Cryptographic Security (HMAC-SHA512)', () => {
    const secret = 'sk_test_mock_secret_key_1234567890abcdef'
    const rawBody = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 999999,
        reference: 'pes_order_123_test',
        amount: 50000,
        currency: 'KES',
        status: 'success',
      },
    })

    function computeSignature(payload: string, key: string): string {
      return crypto.createHmac('sha512', key).update(payload).digest('hex')
    }

    it('accepts valid HMAC-SHA512 signature using Paystack secret', () => {
      const validSignature = computeSignature(rawBody, secret)
      const isValid = verifyPaystackWebhookSignature({
        rawBody,
        signature: validSignature,
        secretKey: secret,
      })
      expect(isValid).toBe(true)
    })

    it('strictly rejects forged or tampered signatures', () => {
      const forgedSignature = 'forged_signature_000000000000000000000000000000000000000000000000'
      const isValid = verifyPaystackWebhookSignature({
        rawBody,
        signature: forgedSignature,
        secretKey: secret,
      })
      expect(isValid).toBe(false)
    })

    it('strictly rejects empty, null, or undefined signatures', () => {
      expect(verifyPaystackWebhookSignature({ rawBody, signature: '', secretKey: secret })).toBe(false)
      expect(verifyPaystackWebhookSignature({ rawBody, signature: null, secretKey: secret })).toBe(false)
      expect(verifyPaystackWebhookSignature({ rawBody, signature: undefined, secretKey: secret })).toBe(false)
    })

    it('strictly rejects modified body even if signature was valid for original body', () => {
      const validSignature = computeSignature(rawBody, secret)
      const tamperedBody = JSON.stringify({
        event: 'charge.success',
        data: { id: 999999, reference: 'pes_order_123_test', amount: 100 },
      })
      const isValid = verifyPaystackWebhookSignature({
        rawBody: tamperedBody,
        signature: validSignature,
        secretKey: secret,
      })
      expect(isValid).toBe(false)
    })
  })

  describe('3. Payout Adapter Fail-Closed & Paystack Routing', () => {
    it('routes M-Pesa payouts directly to Paystack', async () => {
      const result = await sendMpesaPayout({
        phone: '254712345678',
        amount: 1000,
        currency: 'KES',
        narrative: 'Organizer Withdrawal',
      })

      expect(result.trackingId).toBe('trf_mp_mock_123')
    })

    it('routes Bank payouts directly to Paystack', async () => {
      const result = await sendBankPayout({
        bankName: 'Equity Bank',
        accountNumber: '1234567890',
        accountName: 'Organizer Name',
        branchCode: '068',
        amount: 5000,
        currency: 'KES',
        narrative: 'Bank Withdrawal',
      })

      expect(result.trackingId).toBe('trf_bk_mock_456')
    })

    it('fails closed on Paybill payouts with explicit error instead of falling back to legacy provider', async () => {
      await expect(
        sendPaybillPayout({
          paybillNumber: '247247',
          accountNumber: '123456',
          amount: 2000,
          currency: 'KES',
          narrative: 'Paybill Payout',
        })
      ).rejects.toThrow('Paystack does not support Paybill B2B transfers in Kenya')
    })
  })

  describe('4. Phone Normalization (lib/phone.ts)', () => {
    it('correctly normalizes 07xx Kenyan numbers to 2547xx', () => {
      expect(normalizeMpesaPhone('0712345678')).toBe('254712345678')
    })

    it('correctly normalizes 01xx Kenyan numbers to 2541xx', () => {
      expect(normalizeMpesaPhone('0110123456')).toBe('254110123456')
    })

    it('correctly preserves +254 and 254 prefix', () => {
      expect(normalizeMpesaPhone('+254700000000')).toBe('254700000000')
      expect(normalizeMpesaPhone('254700000000')).toBe('254700000000')
    })

    it('validates genuine Kenyan phone numbers and rejects malformed numbers', () => {
      expect(isValidMpesaPhone('0712345678')).toBe(true)
      expect(isValidMpesaPhone('0112345678')).toBe(true)
      expect(isValidMpesaPhone('12345')).toBe(false)
      expect(isValidMpesaPhone('invalid')).toBe(false)
    })
  })
})
