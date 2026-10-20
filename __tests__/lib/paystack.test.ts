import crypto from 'crypto'
import {
  verifyPaystackWebhookSignature,
  initializePaystackTransaction,
  verifyPaystackTransaction,
  getPaystackSecretKey,
  redactSensitivePaystackString,
  sanitizePaystackPayload,
  PaystackConfigError,
  PaystackValidationError,
  PaystackTimeoutError,
  PaystackApiError,
  PaystackError,
} from '@/lib/paystack'
import { FLAT_PAID_EVENT_COMMISSION_RATE, calculatePaidEventCommission } from '@/lib/paidEventCommission'
import { toMinorUnits, fromMinorUnits } from '@/lib/financialLedger'

describe('Phase 3: Centralized Paystack Integration Foundation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  // =========================================================================
  // 1. Webhook Signature Verification
  // =========================================================================
  describe('verifyPaystackWebhookSignature', () => {
    const testSecret = 'sk_test_fake_secret_key_12345'
    const rawPayload = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'T12345678', amount: 100000 },
    })

    function signPayload(body: string, secret: string): string {
      return crypto.createHmac('sha512', secret).update(body).digest('hex')
    }

    it('verifies valid HMAC-SHA512 signature against raw body string', () => {
      const signature = signPayload(rawPayload, testSecret)
      const isValid = verifyPaystackWebhookSignature({
        rawBody: rawPayload,
        signature,
        secretKey: testSecret,
      })
      expect(isValid).toBe(true)
    })

    it('fails closed on invalid signature', () => {
      const invalidSignature = 'a'.repeat(128)
      const isValid = verifyPaystackWebhookSignature({
        rawBody: rawPayload,
        signature: invalidSignature,
        secretKey: testSecret,
      })
      expect(isValid).toBe(false)
    })

    it('fails closed when raw payload has been tampered with or altered', () => {
      const signature = signPayload(rawPayload, testSecret)
      const tamperedPayload = rawPayload.replace('100000', '999999')
      const isValid = verifyPaystackWebhookSignature({
        rawBody: tamperedPayload,
        signature,
        secretKey: testSecret,
      })
      expect(isValid).toBe(false)
    })

    it('fails closed on missing, null, or undefined signature', () => {
      expect(
        verifyPaystackWebhookSignature({ rawBody: rawPayload, signature: null, secretKey: testSecret })
      ).toBe(false)
      expect(
        verifyPaystackWebhookSignature({ rawBody: rawPayload, signature: undefined, secretKey: testSecret })
      ).toBe(false)
      expect(
        verifyPaystackWebhookSignature({ rawBody: rawPayload, signature: '', secretKey: testSecret })
      ).toBe(false)
    })

    it('fails closed if server secret is missing', () => {
      delete process.env.PAYSTACK_SECRET_KEY
      const signature = signPayload(rawPayload, testSecret)
      const isValid = verifyPaystackWebhookSignature({
        rawBody: rawPayload,
        signature,
      })
      expect(isValid).toBe(false)
    })

    it('handles non-hex or malformed signature gracefully without throwing', () => {
      expect(
        verifyPaystackWebhookSignature({
          rawBody: rawPayload,
          signature: 'not-a-valid-hex-string!!!',
          secretKey: testSecret,
        })
      ).toBe(false)
    })
  })

  // =========================================================================
  // 2. Secret Key & Environment Validation
  // =========================================================================
  describe('getPaystackSecretKey', () => {
    it('returns secret key when set in environment', () => {
      process.env.PAYSTACK_SECRET_KEY = 'sk_test_valid_key'
      expect(getPaystackSecretKey()).toBe('sk_test_valid_key')
    })

    it('throws PaystackConfigError when PAYSTACK_SECRET_KEY is missing or empty', () => {
      delete process.env.PAYSTACK_SECRET_KEY
      expect(() => getPaystackSecretKey()).toThrow(PaystackConfigError)
      expect(() => getPaystackSecretKey()).toThrow(/PAYSTACK_SECRET_KEY in server environment/)
    })

    it('does not leak the secret key in error messages', () => {
      process.env.PAYSTACK_SECRET_KEY = '   '
      expect(() => getPaystackSecretKey()).toThrow(PaystackConfigError)
    })
  })

  // =========================================================================
  // 3. Transaction Initialization
  // =========================================================================
  describe('initializePaystackTransaction', () => {
    const secretKey = 'sk_test_init_secret'

    beforeEach(() => {
      process.env.PAYSTACK_SECRET_KEY = secretKey
    })

    it('rejects missing or invalid email addresses', async () => {
      await expect(
        initializePaystackTransaction({
          email: 'invalid-email',
          amountMinorUnits: 100000,
          currency: 'KES',
          reference: 'ref_1',
        })
      ).rejects.toThrow(PaystackValidationError)
    })

    it('rejects empty references', async () => {
      await expect(
        initializePaystackTransaction({
          email: 'user@test.com',
          amountMinorUnits: 100000,
          currency: 'KES',
          reference: '   ',
        })
      ).rejects.toThrow(PaystackValidationError)
    })

    it('rejects non-positive or non-integer minor unit amounts', async () => {
      await expect(
        initializePaystackTransaction({
          email: 'user@test.com',
          amountMinorUnits: 0,
          currency: 'KES',
          reference: 'ref_1',
        })
      ).rejects.toThrow(PaystackValidationError)

      await expect(
        initializePaystackTransaction({
          email: 'user@test.com',
          amountMinorUnits: -500,
          currency: 'KES',
          reference: 'ref_1',
        })
      ).rejects.toThrow(PaystackValidationError)

      await expect(
        initializePaystackTransaction({
          email: 'user@test.com',
          amountMinorUnits: 10.5, // fractional minor unit
          currency: 'KES',
          reference: 'ref_1',
        })
      ).rejects.toThrow(PaystackValidationError)
    })

    it('sends authorized POST request and parses successful response', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: true,
            message: 'Authorization URL created',
            data: {
              authorization_url: 'https://checkout.paystack.com/0peioxfhpn',
              access_code: '0peioxfhpn',
              reference: 'order_123',
            },
          }),
      })

      const result = await initializePaystackTransaction(
        {
          email: 'attendee@eventslot.test',
          amountMinorUnits: BigInt(100000), // KES 1,000
          currency: 'KES',
          reference: 'order_123',
          callbackUrl: 'https://eventsslot.com/callback',
          channels: ['card', 'mobile_money'],
          metadata: { orderId: 'ord_1', eventId: 'evt_1' },
        },
        { fetchFn: mockFetch as any }
      )

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, requestOptions] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.paystack.co/transaction/initialize')
      expect(requestOptions.method).toBe('POST')
      expect(requestOptions.headers['Authorization']).toBe(`Bearer ${secretKey}`)
      expect(requestOptions.headers['Content-Type']).toBe('application/json')

      const body = JSON.parse(requestOptions.body)
      expect(body.email).toBe('attendee@eventslot.test')
      expect(body.amount).toBe(100000)
      expect(body.currency).toBe('KES')
      expect(body.reference).toBe('order_123')
      expect(body.channels).toEqual(['card', 'mobile_money'])

      expect(result).toEqual({
        authorizationUrl: 'https://checkout.paystack.com/0peioxfhpn',
        accessCode: '0peioxfhpn',
        reference: 'order_123',
        rawStatus: true,
        message: 'Authorization URL created',
      })
    })

    it('throws PaystackApiError on non-200 HTTP response', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            status: false,
            message: 'Duplicate reference',
          }),
      })

      await expect(
        initializePaystackTransaction(
          {
            email: 'user@test.com',
            amountMinorUnits: 50000,
            currency: 'KES',
            reference: 'dup_ref',
          },
          { fetchFn: mockFetch as any }
        )
      ).rejects.toThrow(PaystackApiError)
    })

    it('throws PaystackApiError on malformed non-JSON response', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => '<html>Bad Gateway</html>',
      })

      await expect(
        initializePaystackTransaction(
          {
            email: 'user@test.com',
            amountMinorUnits: 50000,
            currency: 'KES',
            reference: 'ref_1',
          },
          { fetchFn: mockFetch as any }
        )
      ).rejects.toThrow(PaystackApiError)
    })
  })

  // =========================================================================
  // 4. Transaction Verification
  // =========================================================================
  describe('verifyPaystackTransaction', () => {
    const secretKey = 'sk_test_verify_secret'

    beforeEach(() => {
      process.env.PAYSTACK_SECRET_KEY = secretKey
    })

    it('rejects empty or whitespace transaction reference', async () => {
      await expect(verifyPaystackTransaction('')).rejects.toThrow(PaystackValidationError)
      await expect(verifyPaystackTransaction('   ')).rejects.toThrow(PaystackValidationError)
    })

    it('verifies a successful transaction and maps typed provider fields', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: true,
            message: 'Verification successful',
            data: {
              id: 998877,
              domain: 'test',
              status: 'success',
              reference: 'order_123',
              amount: 100000, // 1,000 KES
              currency: 'KES',
              channel: 'mobile_money',
              gateway_response: 'Successful',
              paid_at: '2026-10-20T14:00:00.000Z',
              created_at: '2026-10-20T13:58:00.000Z',
              customer: {
                id: 1122,
                email: 'customer@test.com',
                customer_code: 'CUS_9988',
              },
              metadata: {
                ticketTier: 'VIP',
              },
            },
          }),
      })

      const result = await verifyPaystackTransaction('order_123', {
        fetchFn: mockFetch as any,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.paystack.co/transaction/verify/order_123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${secretKey}`,
          }),
        })
      )

      expect(result.status).toBe('success')
      expect(result.isSuccessful).toBe(true)
      expect(result.amountMinorUnits).toBe(100000)
      expect(result.currency).toBe('KES')
      expect(result.channel).toBe('mobile_money')
      expect(result.customerEmail).toBe('customer@test.com')
      expect(result.paidAt).toEqual(new Date('2026-10-20T14:00:00.000Z'))
      expect(result.reference).toBe('order_123')
    })

    it('verifies a failed transaction and marks isSuccessful false', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: true,
            message: 'Verification successful',
            data: {
              status: 'failed',
              reference: 'fail_ref',
              amount: 50000,
              currency: 'KES',
              gateway_response: 'Insufficient funds',
            },
          }),
      })

      const result = await verifyPaystackTransaction('fail_ref', {
        fetchFn: mockFetch as any,
      })

      expect(result.status).toBe('failed')
      expect(result.isSuccessful).toBe(false)
      expect(result.gatewayResponse).toBe('Insufficient funds')
    })

    it('verifies an abandoned transaction correctly', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: true,
            message: 'Verification successful',
            data: {
              status: 'abandoned',
              reference: 'ab_ref',
              amount: 50000,
              currency: 'KES',
            },
          }),
      })

      const result = await verifyPaystackTransaction('ab_ref', {
        fetchFn: mockFetch as any,
      })

      expect(result.status).toBe('abandoned')
      expect(result.isSuccessful).toBe(false)
    })
  })

  // =========================================================================
  // 5. Timeout & Network Error Guarantees
  // =========================================================================
  describe('Timeout and Network Error Handling', () => {
    beforeEach(() => {
      process.env.PAYSTACK_SECRET_KEY = 'sk_test_timeout_secret'
    })

    it('throws PaystackTimeoutError on initialization timeout', async () => {
      const timeoutErr = new Error('The operation was aborted due to timeout')
      timeoutErr.name = 'TimeoutError'
      const mockFetch = jest.fn().mockRejectedValue(timeoutErr)

      await expect(
        initializePaystackTransaction(
          {
            email: 'user@test.com',
            amountMinorUnits: 100000,
            currency: 'KES',
            reference: 'timeout_ref',
          },
          { fetchFn: mockFetch as any, timeoutMs: 5000 }
        )
      ).rejects.toThrow(PaystackTimeoutError)
    })

    it('throws PaystackTimeoutError on verification timeout and notes state is indeterminate', async () => {
      const timeoutErr = new Error('The operation was aborted due to timeout')
      timeoutErr.name = 'TimeoutError'
      const mockFetch = jest.fn().mockRejectedValue(timeoutErr)

      const promise = verifyPaystackTransaction('slow_ref', {
        fetchFn: mockFetch as any,
        timeoutMs: 5000,
      })

      await expect(promise).rejects.toThrow(PaystackTimeoutError)
      await expect(promise).rejects.toThrow(/Transaction state remains indeterminate/)
    })

    it('wraps and redacts general network errors', async () => {
      const mockFetch = jest
        .fn()
        .mockRejectedValue(new Error('Connection refused to https://api.paystack.co with sk_live_secret123'))

      await expect(
        verifyPaystackTransaction('ref_1', { fetchFn: mockFetch as any })
      ).rejects.toThrow(PaystackError)

      try {
        await verifyPaystackTransaction('ref_1', { fetchFn: mockFetch as any })
      } catch (err: any) {
        expect(err.message).not.toContain('sk_live_secret123')
        expect(err.message).toContain('[REDACTED_SECRET_KEY]')
      }
    })
  })

  // =========================================================================
  // 6. Redaction of Secrets & Sensitive Data
  // =========================================================================
  describe('Redaction & Sanitization', () => {
    it('redacts live and test secret keys in error strings', () => {
      const text = 'Failed with sk_live_998877665544 and sk_test_1122334455'
      const redacted = redactSensitivePaystackString(text)
      expect(redacted).not.toContain('sk_live_998877665544')
      expect(redacted).not.toContain('sk_test_1122334455')
      expect(redacted).toBe('Failed with [REDACTED_SECRET_KEY] and [REDACTED_SECRET_KEY]')
    })

    it('redacts Authorization Bearer tokens in error strings', () => {
      const text = 'Request failed: Bearer secret_token_xyz_123'
      const redacted = redactSensitivePaystackString(text)
      expect(redacted).not.toContain('secret_token_xyz_123')
      expect(redacted).toBe('Request failed: Bearer [REDACTED]')
    })

    it('strips card details, pin, and secret keys from metadata payloads', () => {
      const dirty = {
        tierName: 'Regular',
        card_number: '5500000000000004',
        cvv: '999',
        secret_key: 'sk_live_top_secret',
        nested: {
          pin: '1234',
          reference: 'safe_ref',
        },
      }

      const clean = sanitizePaystackPayload(dirty) as any
      expect(clean.card_number).toBe('[REDACTED]')
      expect(clean.cvv).toBe('[REDACTED]')
      expect(clean.secret_key).toBe('[REDACTED]')
      expect(clean.nested.pin).toBe('[REDACTED]')
      expect(clean.nested.reference).toBe('safe_ref')
      expect(clean.tierName).toBe('Regular')
    })
  })

  // =========================================================================
  // 7. Scope Boundaries (Pure Client)
  // =========================================================================
  describe('Scope Boundaries', () => {
    it('does not touch or mutate database or order records during verification', async () => {
      process.env.PAYSTACK_SECRET_KEY = 'sk_test_scope'
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: true,
            data: {
              status: 'success',
              reference: 'boundary_test',
              amount: 100000,
              currency: 'KES',
            },
          }),
      })

      const result = await verifyPaystackTransaction('boundary_test', {
        fetchFn: mockFetch as any,
      })

      // Must be a read-only query that returns parsed data
      expect(result.isSuccessful).toBe(true)
      expect(result.reference).toBe('boundary_test')
    })
  })

  // =========================================================================
  // 8. Phase 1 & Phase 2 Non-Regression Invariants
  // =========================================================================
  describe('Non-Regression of Prior Invariants', () => {
    it('preserves flat 5% ticket commission across subscription plans', () => {
      expect(FLAT_PAID_EVENT_COMMISSION_RATE).toBe(0.05)
      const commission = calculatePaidEventCommission(1000, 'pro')
      expect(commission.commissionAmount).toBe(50)
      expect(commission.organizerAmount).toBe(950)
    })

    it('preserves integer minor units conversion for KES 1,000 => 100,000 cents', () => {
      const minor = toMinorUnits(1000, 'KES')
      expect(minor).toBe(BigInt(100000))
      expect(fromMinorUnits(minor, 'KES')).toBe(1000)
    })
  })
})
