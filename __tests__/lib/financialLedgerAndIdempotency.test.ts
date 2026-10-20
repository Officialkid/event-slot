import {
  toMinorUnits,
  fromMinorUnits,
  getMinorUnitFactor,
  isBalanceIncreasing,
  getSignedAmountMinor,
  calculateLedgerBalance,
  buildOrderProceedsIdempotencyKey,
  buildOrderCommissionIdempotencyKey,
  buildWithdrawalReservationIdempotencyKey,
  buildWithdrawalCompletionIdempotencyKey,
  buildRefundIdempotencyKey,
  buildAdjustmentIdempotencyKey,
  sanitizeLedgerMetadata,
} from '@/lib/financialLedger'
import {
  generateProviderEventIdempotencyKey,
  evaluateEventProcessingDecision,
  sanitizeEventError,
  ProcessedProviderEventRecord,
} from '@/lib/providerEvents'
import {
  FLAT_PAID_EVENT_COMMISSION_RATE,
  calculatePaidEventCommission,
  getPaidEventCommissionRate,
} from '@/lib/paidEventCommission'
import { SUBSCRIPTION_PLANS, getSubscriptionPlan } from '@/lib/subscriptionPlans'

describe('Phase 2: Financial Ledger & Idempotency Foundation', () => {
  describe('Financial Ledger - Integer Minor Units & Currencies', () => {
    it('correctly converts major units to integer minor units (KES 1,000 => 100,000 cents)', () => {
      const minor = toMinorUnits(1000, 'KES')
      expect(minor).toBe(BigInt(100000))
      expect(typeof minor).toBe('bigint')
    })

    it('converts USD major units to minor units (USD 25.50 => 2,550 cents)', () => {
      const minor = toMinorUnits(25.5, 'USD')
      expect(minor).toBe(BigInt(2550))
    })

    it('safely handles zero and invalid amounts by returning BigInt(0)', () => {
      expect(toMinorUnits(0, 'KES')).toBe(BigInt(0))
      expect(toMinorUnits(-100, 'KES')).toBe(BigInt(0))
      expect(toMinorUnits(NaN, 'KES')).toBe(BigInt(0))
      expect(toMinorUnits(Infinity, 'KES')).toBe(BigInt(0))
    })

    it('correctly converts minor units back to major units without floating point corruption', () => {
      expect(fromMinorUnits(BigInt(100000), 'KES')).toBe(1000)
      expect(fromMinorUnits(BigInt(2550), 'USD')).toBe(25.5)
      expect(fromMinorUnits(BigInt(0), 'KES')).toBe(0)
    })

    it('defaults unknown currencies to factor 100 safely', () => {
      expect(getMinorUnitFactor('UNKNOWN')).toBe(100)
      expect(toMinorUnits(50, 'UNKNOWN')).toBe(BigInt(5000))
    })
  })

  describe('Financial Ledger - Direction & Accounting Convention', () => {
    it('recognizes CREDIT as increasing account balance and DEBIT as decreasing', () => {
      expect(isBalanceIncreasing('CREDIT')).toBe(true)
      expect(isBalanceIncreasing('DEBIT')).toBe(false)
    })

    it('computes correct signed amount for CREDIT (+positive) and DEBIT (-negative)', () => {
      expect(getSignedAmountMinor('CREDIT', BigInt(5000))).toBe(BigInt(5000))
      expect(getSignedAmountMinor('DEBIT', BigInt(5000))).toBe(BigInt(-5000))
    })

    it('calculates net organizer balance from ledger entries with 100% mathematical precision', () => {
      // Scenario:
      // Ticket 1: KES 1,000 gross proceeds (CREDIT 100,000)
      // Ticket 1 commission: KES 50 (DEBIT 5,000)
      // Ticket 2: KES 2,500 gross proceeds (CREDIT 250,000)
      // Ticket 2 commission: KES 125 (DEBIT 12,500)
      // Withdrawal reservation: KES 1,000 (DEBIT 100,000)
      const entries = [
        { direction: 'CREDIT' as const, amountMinorUnits: BigInt(100000) },
        { direction: 'DEBIT' as const, amountMinorUnits: BigInt(5000) },
        { direction: 'CREDIT' as const, amountMinorUnits: BigInt(250000) },
        { direction: 'DEBIT' as const, amountMinorUnits: BigInt(12500) },
        { direction: 'DEBIT' as const, amountMinorUnits: BigInt(100000) },
      ]

      const result = calculateLedgerBalance(entries)
      expect(result.totalCreditsMinorUnits).toBe(BigInt(350000)) // 3,500 KES
      expect(result.totalDebitsMinorUnits).toBe(BigInt(117500))  // 1,175 KES
      expect(result.balanceMinorUnits).toBe(BigInt(232500))       // 2,325 KES (950 + 2375 - 1000)
    })
  })

  describe('Financial Ledger - Deterministic Idempotency Keys', () => {
    it('generates deterministic idempotency keys for ticket proceeds and commission', () => {
      expect(buildOrderProceedsIdempotencyKey('ord_123')).toBe('order:ord_123:proceeds')
      expect(buildOrderCommissionIdempotencyKey('ord_123')).toBe('order:ord_123:commission')
      expect(buildOrderProceedsIdempotencyKey('ord_123')).not.toBe(
        buildOrderCommissionIdempotencyKey('ord_123')
      )
    })

    it('generates distinct keys for withdrawal reservations and completions', () => {
      expect(buildWithdrawalReservationIdempotencyKey('wth_456')).toBe(
        'withdrawal:wth_456:reservation'
      )
      expect(buildWithdrawalCompletionIdempotencyKey('wth_456')).toBe(
        'withdrawal:wth_456:completion'
      )
    })

    it('generates distinct keys for refunds and adjustments', () => {
      expect(buildRefundIdempotencyKey('pay_1', 'ref_99')).toBe('refund:pay_1:ref_99')
      expect(buildAdjustmentIdempotencyKey('ADJ-2026-001')).toBe('adj:ADJ-2026-001')
    })
  })

  describe('Financial Ledger - Metadata Sanitization', () => {
    it('strips secrets, tokens, cvv, and card numbers from metadata', () => {
      const dirty = {
        tierName: 'VIP',
        ticketCount: 2,
        cvv: '123',
        card_number: '4111111111111111',
        secret_key: 'sk_live_very_secret',
        nested: {
          note: 'Customer approved',
          pin: '0000',
        },
      }

      const clean = sanitizeLedgerMetadata(dirty)
      expect(clean).toEqual({
        tierName: 'VIP',
        ticketCount: 2,
        nested: {
          note: 'Customer approved',
        },
      })
      expect((clean as any).cvv).toBeUndefined()
      expect((clean as any).card_number).toBeUndefined()
      expect((clean as any).secret_key).toBeUndefined()
      expect((clean as any).nested.pin).toBeUndefined()
    })
  })

  describe('Provider Event Idempotency - Key Derivation', () => {
    it('prefers provider eventId when available', () => {
      const key = generateProviderEventIdempotencyKey({
        provider: 'Paystack',
        eventType: 'charge.success',
        providerEventId: 'evt_998877',
        reference: 'T12345678',
      })
      expect(key).toBe('paystack:event:evt_998877')
    })

    it('falls back safely to provider + eventType + reference when eventId is absent', () => {
      const key = generateProviderEventIdempotencyKey({
        provider: 'paystack',
        eventType: 'charge.success',
        providerEventId: null,
        reference: 'T12345678',
      })
      expect(key).toBe('paystack:charge.success:ref:T12345678')
    })

    it('throws when neither providerEventId nor reference is provided to avoid merging unrelated payments', () => {
      expect(() =>
        generateProviderEventIdempotencyKey({
          provider: 'paystack',
          eventType: 'charge.success',
          providerEventId: null,
          reference: null,
        })
      ).toThrow('missing eventId and reference')
    })
  })

  describe('Provider Event Idempotency - Lifecycle & Safe Retry State Machine', () => {
    it('allows initial processing for newly received events (null record)', () => {
      const decision = evaluateEventProcessingDecision(null)
      expect(decision.shouldProcess).toBe(true)
      expect(decision.action).toBe('CREATE_AND_PROCESS')
    })

    it('allows processing for queued RECEIVED events', () => {
      const record: ProcessedProviderEventRecord = {
        id: 'rec_1',
        provider: 'paystack',
        eventId: 'evt_1',
        eventType: 'charge.success',
        idempotencyKey: 'paystack:event:evt_1',
        status: 'RECEIVED',
        reference: 'ref_1',
        orderId: null,
        paymentId: null,
        firstSeenAt: new Date(),
        lastAttemptAt: null,
        processedAt: null,
        attemptCount: 1,
        error: null,
      }

      const decision = evaluateEventProcessingDecision(record)
      expect(decision.shouldProcess).toBe(true)
      expect(decision.action).toBe('PROCESS_RECEIVED')
    })

    it('permanently blocks duplicate execution of successfully PROCESSED events', () => {
      const record: ProcessedProviderEventRecord = {
        id: 'rec_1',
        provider: 'paystack',
        eventId: 'evt_1',
        eventType: 'charge.success',
        idempotencyKey: 'paystack:event:evt_1',
        status: 'PROCESSED',
        reference: 'ref_1',
        orderId: 'ord_1',
        paymentId: 'pay_1',
        firstSeenAt: new Date(Date.now() - 3600000),
        lastAttemptAt: new Date(Date.now() - 3600000),
        processedAt: new Date(Date.now() - 3600000),
        attemptCount: 1,
        error: null,
      }

      const decision = evaluateEventProcessingDecision(record)
      expect(decision.shouldProcess).toBe(false)
      expect(decision.action).toBe('IGNORE_SUCCESS')
    })

    it('defers concurrent delivery when an event is actively in PROCESSING state within lock timeout', () => {
      const record: ProcessedProviderEventRecord = {
        id: 'rec_1',
        provider: 'paystack',
        eventId: 'evt_1',
        eventType: 'charge.success',
        idempotencyKey: 'paystack:event:evt_1',
        status: 'PROCESSING',
        reference: 'ref_1',
        orderId: null,
        paymentId: null,
        firstSeenAt: new Date(Date.now() - 10000), // 10s ago
        lastAttemptAt: new Date(Date.now() - 10000),
        processedAt: null,
        attemptCount: 1,
        error: null,
      }

      const decision = evaluateEventProcessingDecision(record, 60000)
      expect(decision.shouldProcess).toBe(false)
      expect(decision.action).toBe('DEFER_CONCURRENT')
    })

    it('allows recovery retry if a worker hung or crashed in PROCESSING state and lock expired', () => {
      const record: ProcessedProviderEventRecord = {
        id: 'rec_1',
        provider: 'paystack',
        eventId: 'evt_1',
        eventType: 'charge.success',
        idempotencyKey: 'paystack:event:evt_1',
        status: 'PROCESSING',
        reference: 'ref_1',
        orderId: null,
        paymentId: null,
        firstSeenAt: new Date(Date.now() - 120000), // 120s ago (> 60s)
        lastAttemptAt: new Date(Date.now() - 120000),
        processedAt: null,
        attemptCount: 1,
        error: null,
      }

      const decision = evaluateEventProcessingDecision(record, 60000)
      expect(decision.shouldProcess).toBe(true)
      expect(decision.action).toBe('RETRY_EXPIRED_LOCK')
    })

    it('never permanently blocks legitimate retries after a FAILED attempt', () => {
      const record: ProcessedProviderEventRecord = {
        id: 'rec_1',
        provider: 'paystack',
        eventId: 'evt_1',
        eventType: 'charge.success',
        idempotencyKey: 'paystack:event:evt_1',
        status: 'FAILED',
        reference: 'ref_1',
        orderId: null,
        paymentId: null,
        firstSeenAt: new Date(Date.now() - 30000),
        lastAttemptAt: new Date(Date.now() - 30000),
        processedAt: null,
        attemptCount: 1,
        error: 'Database connection timeout',
      }

      const decision = evaluateEventProcessingDecision(record)
      expect(decision.shouldProcess).toBe(true)
      expect(decision.action).toBe('RETRY_FAILED')
    })

    it('scrubs secret keys and bearer tokens from event error messages', () => {
      const err = new Error('HTTP 401: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid, sk_live_secret123')
      const sanitized = sanitizeEventError(err)
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid')
      expect(sanitized).not.toContain('sk_live_secret123')
      expect(sanitized).toContain('Bearer [REDACTED]')
      expect(sanitized).toContain('[REDACTED_SECRET_KEY]')
    })
  })

  describe('Non-Regression of Phase 1 Business Invariants', () => {
    it('maintains flat 5% ticket commission across all subscription plans', () => {
      expect(FLAT_PAID_EVENT_COMMISSION_RATE).toBe(0.05)
      expect(getPaidEventCommissionRate('free')).toBe(0.05)
      expect(getPaidEventCommissionRate('standard')).toBe(0.05)
      expect(getPaidEventCommissionRate('pro')).toBe(0.05)
      expect(getPaidEventCommissionRate('business')).toBe(0.05)
    })

    it('maintains 95% organizer entitlement on KES 1,000 ticket (KES 50 platform, KES 950 organizer)', () => {
      const result = calculatePaidEventCommission(1000, 'pro')
      expect(result.commissionAmount).toBe(50)
      expect(result.organizerAmount).toBe(950)
      expect(result.commissionRate).toBe(0.05)
      expect(result.commissionAmount + result.organizerAmount).toBe(1000)
    })

    it('preserves all subscription catalog prices, seats, and limits', () => {
      const free = getSubscriptionPlan('free')
      expect(free.monthlyPriceUsd).toBe(0)
      expect(free.annualPriceUsd).toBe(0)

      const standard = getSubscriptionPlan('standard')
      expect(standard.monthlyPriceUsd).toBe(9)
      expect(standard.annualPriceUsd).toBe(90)

      const pro = getSubscriptionPlan('pro')
      expect(pro.monthlyPriceUsd).toBe(25)
      expect(pro.annualPriceUsd).toBe(250)

      const business = getSubscriptionPlan('business')
      expect(business.monthlyPriceUsd).toBe(69)
      expect(business.annualPriceUsd).toBe(690)

      for (const plan of SUBSCRIPTION_PLANS) {
        expect(plan.commissionRate).toBe(0.05)
      }
    })
  })
})
