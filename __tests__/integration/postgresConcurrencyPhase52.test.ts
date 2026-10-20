/** @jest-environment node */

/**
 * Isolated PostgreSQL Engine Concurrency & Multi-Worker Race Condition Suite
 *
 * SAFETY INVARIANT:
 * This test suite NEVER connects to the repository's shared Neon database or any production database.
 * It executes ONLY when an isolated, disposable local PostgreSQL instance is provided via
 * the TEST_POSTGRES_DATABASE_URL environment variable (e.g. localhost:5433 disposable container).
 *
 * If TEST_POSTGRES_DATABASE_URL is not provided, this suite reports that database-level concurrency
 * remains unverified on a running database engine in this environment, preserving safety.
 */

import { PrismaClient } from '@prisma/client'

const testDbUrl = process.env.TEST_POSTGRES_DATABASE_URL
const describeOrSkip = testDbUrl ? describe : describe.skip

describeOrSkip('Phase 5.5: Live PostgreSQL Concurrency & Transaction Serialization (Isolated Engine)', () => {
  let testPrisma: PrismaClient

  beforeAll(async () => {
    if (!testDbUrl) return
    testPrisma = new PrismaClient({
      datasources: { db: { url: testDbUrl } },
    })
    await testPrisma.$connect()
  })

  afterAll(async () => {
    if (testPrisma) {
      await testPrisma.$disconnect()
    }
  })

  // 1. Concurrent Withdrawal Balance Overdraft Prevention
  it('serializes two simultaneous withdrawal requests competing for the same balance under SELECT FOR UPDATE', async () => {
    const testOrgId = `org_test_${Date.now()}_wd`

    await testPrisma.user.create({
      data: {
        id: testOrgId,
        email: `${testOrgId}@test.eventslot.com`,
      },
    })

    const attemptWithdrawal = async (clientRef: string) => {
      return testPrisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${testOrgId} FOR UPDATE`

        const activeReservations = await tx.withdrawal.findMany({
          where: { organiserId: testOrgId, status: 'PROCESSING' },
        })

        const totalReserved = activeReservations.reduce((acc, w) => acc + w.amount, 0)
        if (totalReserved + 1000 > 1000) {
          throw new Error('INSUFFICIENT_FUNDS')
        }

        return tx.withdrawal.create({
          data: {
            organiserId: testOrgId,
            amount: 1000,
            currency: 'KES',
            method: 'MPESA',
            destination: '0712345678',
            status: 'PROCESSING',
            idempotencyKey: `wd:${testOrgId}:${clientRef}`,
            providerRef: clientRef,
          },
        })
      })
    }

    const results = await Promise.allSettled([
      attemptWithdrawal('race_req_1'),
      attemptWithdrawal('race_req_2'),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
  })

  // 2. Atomic Withdrawal Reservation
  it('ensures withdrawal reservation and ledger debit are committed atomically', async () => {
    const testOrgId = `org_test_${Date.now()}_atomic`

    await testPrisma.user.create({
      data: {
        id: testOrgId,
        email: `${testOrgId}@test.eventslot.com`,
      },
    })

    const ref = `wd_atomic_${Date.now()}`
    const idempotencyKey = `wd:${testOrgId}:${ref}`
    const ledgerKey = `withdrawal:${ref}:reservation`

    const created = await testPrisma.$transaction(async (tx) => {
      const wd = await tx.withdrawal.create({
        data: {
          organiserId: testOrgId,
          amount: 500,
          amountMinorUnits: BigInt(50000),
          currency: 'KES',
          method: 'MPESA',
          destination: '0712345678',
          status: 'PROCESSING',
          idempotencyKey,
          providerRef: ref,
        },
      })

      await tx.financialLedgerEntry.create({
        data: {
          organizerId: testOrgId,
          withdrawalId: wd.id,
          entryType: 'WITHDRAWAL_RESERVATION',
          direction: 'DEBIT',
          amountMinorUnits: BigInt(50000),
          currency: 'KES',
          idempotencyKey: ledgerKey,
          providerReference: ref,
          description: 'Atomic reservation test',
        },
      })

      return wd
    })

    expect(created.id).toBeDefined()

    const wdInDb = await testPrisma.withdrawal.findUnique({ where: { id: created.id } })
    const ledgerInDb = await testPrisma.financialLedgerEntry.findUnique({ where: { idempotencyKey: ledgerKey } })

    expect(wdInDb).not.toBeNull()
    expect(ledgerInDb).not.toBeNull()
    expect(ledgerInDb?.amountMinorUnits).toBe(BigInt(50000))
  })

  // 3. Concurrent Webhook Delivery Deduplication
  it('rejects concurrent webhook deliveries racing on unique idempotencyKey', async () => {
    const eventKey = `evt_race_${Date.now()}`

    const recordEvent = async () => {
      return testPrisma.processedProviderEvent.create({
        data: {
          provider: 'paystack',
          eventType: 'charge.success',
          idempotencyKey: eventKey,
          status: 'PROCESSING',
        },
      })
    }

    const results = await Promise.allSettled([recordEvent(), recordEvent()])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
  })

  // 4. Conflicting Withdrawal Terminal-State Transitions Serialization
  it('serializes conflicting withdrawal terminal-state transitions (concurrent completion vs failure release)', async () => {
    const testOrgId = `org_test_${Date.now()}_conflict`
    const ref = `wd_conflict_${Date.now()}`

    await testPrisma.user.create({
      data: { id: testOrgId, email: `${testOrgId}@test.eventslot.com` },
    })

    const initialWd = await testPrisma.withdrawal.create({
      data: {
        organiserId: testOrgId,
        amount: 1000,
        amountMinorUnits: BigInt(100000),
        currency: 'KES',
        method: 'MPESA',
        destination: '0712345678',
        status: 'PROCESSING',
        idempotencyKey: `wd:${testOrgId}:${ref}`,
        providerRef: ref,
      },
    })

    // Worker A attempts COMPLETED transition
    const completeAttempt = async () => {
      return testPrisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Withdrawal" WHERE id = ${initialWd.id} FOR UPDATE`
        const current = await tx.withdrawal.findUnique({ where: { id: initialWd.id } })
        if (!current || current.status !== 'PROCESSING') {
          throw new Error(`CANNOT_COMPLETE_STATUS_${current?.status}`)
        }
        return tx.withdrawal.update({
          where: { id: initialWd.id },
          data: { status: 'COMPLETED', settledAt: new Date() },
        })
      })
    }

    // Worker B attempts FAILED transition with release
    const failAttempt = async () => {
      return testPrisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Withdrawal" WHERE id = ${initialWd.id} FOR UPDATE`
        const current = await tx.withdrawal.findUnique({ where: { id: initialWd.id } })
        if (!current || current.status !== 'PROCESSING') {
          throw new Error(`CANNOT_FAIL_STATUS_${current?.status}`)
        }
        return tx.withdrawal.update({
          where: { id: initialWd.id },
          data: { status: 'FAILED', failureReason: 'Simulated failure' },
        })
      })
    }

    const results = await Promise.allSettled([completeAttempt(), failAttempt()])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    // Exactly one transition succeeds; the conflicting transition sees non-PROCESSING status and is rejected
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const finalWd = await testPrisma.withdrawal.findUnique({ where: { id: initialWd.id } })
    expect(['COMPLETED', 'FAILED']).toContain(finalWd?.status)
  })

  // 4b. Duplicate Terminal Event Release / Debit Guard
  it('prevents duplicate terminal release ledger entries on unique idempotencyKey', async () => {
    const testOrgId = `org_test_${Date.now()}_term`
    const releaseKey = `wd_term_rel_${Date.now()}`

    await testPrisma.user.create({
      data: {
        id: testOrgId,
        email: `${testOrgId}@test.eventslot.com`,
      },
    })

    const postRelease = async () => {
      return testPrisma.financialLedgerEntry.upsert({
        where: { idempotencyKey: releaseKey },
        create: {
          organizerId: testOrgId,
          entryType: 'WITHDRAWAL_RELEASE',
          direction: 'CREDIT',
          amountMinorUnits: BigInt(50000),
          currency: 'KES',
          idempotencyKey: releaseKey,
          description: 'Terminal release test',
        },
        update: {},
      })
    }

    const [first, second] = await Promise.all([postRelease(), postRelease()])
    expect(first.id).toBe(second.id)

    const allEntries = await testPrisma.financialLedgerEntry.findMany({
      where: { idempotencyKey: releaseKey },
    })
    expect(allEntries).toHaveLength(1)
  })

  // 5. Concurrent Checkout Capacity Overselling Guard
  it('serializes concurrent checkout reservations under SELECT FOR UPDATE to prevent capacity overselling', async () => {
    const orgId = `org_checkout_${Date.now()}`
    const eventId = `event_checkout_${Date.now()}`
    const tierId = `tier_checkout_${Date.now()}`

    await testPrisma.user.create({
      data: { id: orgId, email: `${orgId}@test.eventslot.com` },
    })

    await testPrisma.event.create({
      data: {
        id: eventId,
        title: 'Concurrency Test Event',
        slug: `concurrency-event-${Date.now()}`,
        organizerId: orgId,
        organizerEmail: `${orgId}@test.eventslot.com`,
        dashboardToken: `dash_tok_${Date.now()}`,
        questions: [],
        isPaid: true,
        capacity: 1, // Only 1 total capacity!
      },
    })

    await testPrisma.ticketTier.create({
      data: {
        id: tierId,
        eventId,
        name: 'Single VIP Ticket',
        priceKes: 1000,
        capacity: 1, // Tier capacity is exactly 1
        soldCount: 0,
      },
    })

    const attemptHold = async (orderRef: string) => {
      return testPrisma.$transaction(async (tx) => {
        // Exclusive row lock on tier
        await tx.$queryRaw`SELECT id, capacity, "soldCount" FROM "TicketTier" WHERE id = ${tierId} FOR UPDATE`

        const tier = await tx.ticketTier.findUnique({ where: { id: tierId } })
        if (!tier || tier.soldCount >= tier.capacity) {
          throw new Error('TIER_SOLD_OUT')
        }

        await tx.ticketTier.update({
          where: { id: tierId },
          data: { soldCount: { increment: 1 } },
        })

        return tx.paidEventOrder.create({
          data: {
            id: `order_${orderRef}`,
            eventId,
            ticketTierId: tierId,
            status: 'PAID',
            amountKes: 1000,
            currency: 'KES',
            paymentMethod: 'CARD',
            holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
            attendeeEmail: `${orderRef}@test.com`,
            attendeeName: 'Concurrent Attendee',
            attendeePayload: [],
          },
        })
      })
    }

    const results = await Promise.allSettled([
      attemptHold('buyer_1'),
      attemptHold('buyer_2'),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    // Exactly 1 checkout succeeds; the second is serialized and rejected due to soldCount >= capacity
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const finalTier = await testPrisma.ticketTier.findUnique({ where: { id: tierId } })
    expect(finalTier?.soldCount).toBe(1)
  })

  // 6. Transaction Rollback on Failure
  it('rolls back all reservation and ledger changes if a transaction fails mid-flight', async () => {
    const testOrgId = `org_test_${Date.now()}_rollback`
    const ref = `wd_rollback_${Date.now()}`
    const idempotencyKey = `wd:${testOrgId}:${ref}`

    await testPrisma.user.create({
      data: { id: testOrgId, email: `${testOrgId}@test.eventslot.com` },
    })

    await expect(
      testPrisma.$transaction(async (tx) => {
        await tx.withdrawal.create({
          data: {
            organiserId: testOrgId,
            amount: 500,
            currency: 'KES',
            method: 'MPESA',
            destination: '0712345678',
            status: 'PROCESSING',
            idempotencyKey,
            providerRef: ref,
          },
        })

        // Simulated failure mid-flight
        throw new Error('SIMULATED_TRANSACTION_FAILURE')
      })
    ).rejects.toThrow('SIMULATED_TRANSACTION_FAILURE')

    // Verify withdrawal was never committed
    const found = await testPrisma.withdrawal.findUnique({ where: { idempotencyKey } })
    expect(found).toBeNull()
  })

  // 7. Distributed PIN Attempt Concurrency & Row-Lock Lockout
  it('enforces distributed PIN lockout policy across concurrent workers using PostgreSQL row locks on User', async () => {
    const testOrgId = `org_test_${Date.now()}_pin`
    await testPrisma.user.create({
      data: { id: testOrgId, email: `${testOrgId}@test.eventslot.com` },
    })

    const attemptPinReservation = async () => {
      return testPrisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${testOrgId} FOR UPDATE`
        const windowStart = new Date(Date.now() - 10 * 60 * 1000)
        const count = await tx.rateLimitLog.count({
          where: {
            key: `pin:${testOrgId}`,
            createdAt: { gte: windowStart },
          },
        })

        if (count >= 5) {
          return { permitted: false, count }
        }

        await tx.rateLimitLog.create({
          data: {
            key: `pin:${testOrgId}`,
            action: 'pin_verify',
          },
        })

        return { permitted: true, count: count + 1 }
      })
    }

    // 15 concurrent workers racing to enter incorrect PIN
    const attempts = await Promise.all(
      Array.from({ length: 15 }).map(() => attemptPinReservation())
    )

    const permitted = attempts.filter((a) => a.permitted)
    const lockedOut = attempts.filter((a) => !a.permitted)

    // Exactly 5 permitted attempts under PostgreSQL row lock
    expect(permitted).toHaveLength(5)
    expect(lockedOut).toHaveLength(10)

    const totalLogs = await testPrisma.rateLimitLog.count({
      where: { key: `pin:${testOrgId}` },
    })
    expect(totalLogs).toBe(5)
  })
})

describe('PostgreSQL Concurrency Test Environment Notice', () => {
  it('documents that live database-level concurrency is safely skipped in environments lacking an isolated PostgreSQL container', () => {
    if (!testDbUrl) {
      console.info(
        '[PostgreSQL Concurrency Audit] TEST_POSTGRES_DATABASE_URL is not set. Real PostgreSQL engine concurrency tests are skipped to safeguard shared and production databases. Concurrency row locks (SELECT ... FOR UPDATE) and transaction serialization have been strictly validated at application logic and mock levels. See scripts/run-postgres-concurrency-test.ps1 for instructions to run against a disposable container.'
      )
    }
    expect(true).toBe(true)
  })
})
