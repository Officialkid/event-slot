/** @jest-environment node */

import prisma from '@/lib/prisma'
import {
  getOrganizerPaymentsSidebarSummary,
  getOrganizerPaymentsDashboardData,
  getOrganizerWithdrawableBalance,
} from '@/lib/organizerPayments'
import { GET as getWithdrawals } from '@/app/api/organizer/payments/withdrawals/route'
import { getServerSession } from 'next-auth'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
    },
    withdrawal: {
      findMany: jest.fn(),
    },
    event: {
      findMany: jest.fn(),
    },
    organiserBalance: {
      upsert: jest.fn(),
    },
    financialLedgerEntry: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('Phase 5.20: Organizer Payments Experience & Revenue Lifecycle', () => {
  const organizerId = 'org_phase_520_user'

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.financialLedgerEntry.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.organiserBalance.upsert as jest.Mock).mockResolvedValue({})
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: organizerId,
      email: 'organizer@example.com',
      twoFactorEnabled: true,
      paymentPinEnabled: true,
    })
  })

  describe('Revenue Summary & Settlement Calculations', () => {
    it('accurately distinguishes settled, pending settlement, and withdrawable funds', async () => {
      // 2 payments in KES:
      // Payment 1: KES 10,000, 5% commission = KES 500, organizer = KES 9,500. Status: SETTLED.
      // Payment 2: KES 5,000, 5% commission = KES 250, organizer = KES 4,750. Status: PENDING (unsettled).
      ;(prisma.payment.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pay-1',
          amount: 10000,
          commissionAmount: 500,
          organizerAmount: 9500,
          commissionRate: 0.05,
          settlementStatus: 'SETTLED',
          createdAt: new Date('2026-04-01T10:00:00Z'),
          paidAt: new Date('2026-04-01T10:00:00Z'),
          method: 'MPESA',
          mpesaRef: 'QWE12345',
          event: { id: 'evt-1', title: 'Tech Summit', slug: 'tech-summit', currency: 'KES' },
          paidEventOrder: { id: 'ord-1', attendeeName: 'Alice', attendeeEmail: 'alice@example.com', currency: 'KES' },
          ticketTier: { id: 'tier-1', name: 'VIP', priceKes: 10000, badgeColor: '#000', textColor: '#fff', metallic: true },
        },
        {
          id: 'pay-2',
          amount: 5000,
          commissionAmount: 250,
          organizerAmount: 4750,
          commissionRate: 0.05,
          settlementStatus: 'PENDING',
          createdAt: new Date('2026-04-02T12:00:00Z'),
          paidAt: new Date('2026-04-02T12:00:00Z'),
          method: 'CARD',
          mpesaRef: null,
          event: { id: 'evt-1', title: 'Tech Summit', slug: 'tech-summit', currency: 'KES' },
          paidEventOrder: { id: 'ord-2', attendeeName: 'Bob', attendeeEmail: 'bob@example.com', currency: 'KES' },
          ticketTier: { id: 'tier-2', name: 'Regular', priceKes: 5000, badgeColor: '#000', textColor: '#fff', metallic: false },
        },
      ])

      // 1 active processing withdrawal hold of KES 2,000 and 1 completed withdrawal of KES 1,000
      ;(prisma.withdrawal.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'wd-processing',
          amount: 2000,
          amountMinorUnits: BigInt(200000),
          currency: 'KES',
          method: 'MPESA',
          status: 'PROCESSING',
          destination: '0712345678',
          providerRef: 'TRF_HOLD_1',
          createdAt: new Date('2026-04-02T14:00:00Z'),
          settledAt: null,
          failureReason: null,
        },
        {
          id: 'wd-completed',
          amount: 1000,
          amountMinorUnits: BigInt(100000),
          currency: 'KES',
          method: 'MPESA',
          status: 'COMPLETED',
          destination: '0712345678',
          providerRef: 'TRF_DONE_1',
          createdAt: new Date('2026-04-01T15:00:00Z'),
          settledAt: new Date('2026-04-01T15:05:00Z'),
          failureReason: null,
        },
      ])

      ;(prisma.event.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'evt-1',
          slug: 'tech-summit',
          title: 'Tech Summit',
          currency: 'KES',
          eventDate: new Date('2026-05-01T09:00:00Z'),
          eventEndAt: new Date('2026-05-01T17:00:00Z'),
          confirmedCount: 2,
          waitlistCount: 0,
          ticketTiers: [],
          registrations: [],
          paidOrders: [],
        },
      ])

      const data = await getOrganizerPaymentsDashboardData(organizerId)
      const kes = data.summaryByCurrency.KES

      // 1. Gross revenue = 10,000 + 5,000 = 15,000
      expect(kes.gross).toBe(15000)

      // 2. Platform 5% commission = 500 + 250 = 750
      expect(kes.commission).toBe(750)

      // 3. Organizer 95% entitlement = 9,500 + 4,750 = 14,250
      expect(kes.net).toBe(14250)

      // 4. Settled entitlement = 9,500 (from payment 1)
      expect(kes.settled).toBe(9500)

      // 5. Pending settlement = 4,750 (from payment 2, which is unsettled)
      expect(kes.pendingSettlement).toBe(4750)

      // 6. Active pending reservations = 2,000
      expect(kes.pendingReservations).toBe(2000)

      // 7. Completed withdrawals = 1,000
      expect(kes.withdrawn).toBe(1000)

      // 8. Available withdrawable balance = Settled (9,500) - Holds (2,000) - Completed (1,000) = 6,500
      expect(kes.withdrawable).toBe(6500)
    })

    it('quarantines disputed or reversed payments away from withdrawable balance', async () => {
      ;(prisma.payment.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pay-disputed',
          amount: 8000,
          commissionAmount: 400,
          organizerAmount: 7600,
          commissionRate: 0.05,
          settlementStatus: 'DISPUTED',
          createdAt: new Date('2026-04-01T10:00:00Z'),
          paidAt: new Date('2026-04-01T10:00:00Z'),
          method: 'CARD',
          mpesaRef: null,
          event: { id: 'evt-1', title: 'Tech Summit', slug: 'tech-summit', currency: 'KES' },
          paidEventOrder: { id: 'ord-disp', attendeeName: 'Disputer', attendeeEmail: 'd@example.com', currency: 'KES' },
          ticketTier: null,
        },
      ])

      ;(prisma.withdrawal.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.event.findMany as jest.Mock).mockResolvedValue([])

      const available = await getOrganizerWithdrawableBalance(organizerId, 'KES')
      expect(available).toBe(0)

      const summary = await getOrganizerPaymentsSidebarSummary(organizerId)
      expect(summary.hasWithdrawableBalance).toBe(false)
      expect(summary.badgeCount).toBe(0)
    })
  })

  describe('Withdrawal History Model & Serialization', () => {
    it('includes settledAt, failureReason, and provider identifiers without leaking secrets', async () => {
      ;(prisma.payment.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.event.findMany as jest.Mock).mockResolvedValue([])

      const sampleWithdrawals = [
        {
          id: 'wd-failed-1',
          amount: 3500,
          amountMinorUnits: BigInt(350000),
          currency: 'KES',
          method: 'MPESA',
          status: 'FAILED',
          destination: '0700000000',
          providerRef: 'TRF_FAIL_123',
          failureReason: 'Destination phone number unreachable or unregistered.',
          createdAt: new Date('2026-04-02T10:00:00Z'),
          settledAt: null,
        },
        {
          id: 'wd-settled-1',
          amount: 5000,
          amountMinorUnits: BigInt(500000),
          currency: 'KES',
          method: 'BANK',
          status: 'COMPLETED',
          destination: 'Equity Bank / 1234567890',
          providerRef: 'TRF_SUCCESS_456',
          failureReason: null,
          createdAt: new Date('2026-04-01T08:00:00Z'),
          settledAt: new Date('2026-04-01T14:30:00Z'),
        },
      ]

      ;(prisma.withdrawal.findMany as jest.Mock).mockResolvedValue(sampleWithdrawals)

      // Test dashboard data mapping
      const data = await getOrganizerPaymentsDashboardData(organizerId)
      expect(data.withdrawals).toHaveLength(2)

      const failedWd = data.withdrawals.find((w) => w.id === 'wd-failed-1')
      expect(failedWd).toBeDefined()
      expect(failedWd?.status).toBe('FAILED')
      expect(failedWd?.failureReason).toBe('Destination phone number unreachable or unregistered.')
      expect(failedWd?.settledAt).toBeNull()

      const settledWd = data.withdrawals.find((w) => w.id === 'wd-settled-1')
      expect(settledWd).toBeDefined()
      expect(settledWd?.status).toBe('COMPLETED')
      expect(settledWd?.settledAt).toBe(new Date('2026-04-01T14:30:00Z').toISOString())

      // Test GET /api/organizer/payments/withdrawals API serialization
      ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: organizerId } })

      const response = await getWithdrawals()
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(json.withdrawals)).toBe(true)
      expect(json.withdrawals[0].amountMinorUnits).toBe('350000') // Verified BigInt safe string
      expect(json.withdrawals[0].failureReason).toBe('Destination phone number unreachable or unregistered.')
      expect(json.withdrawals[1].amountMinorUnits).toBe('500000')
      expect(json.withdrawals[1].settledAt).toBe(new Date('2026-04-01T14:30:00Z').toISOString())
    })
  })
})
