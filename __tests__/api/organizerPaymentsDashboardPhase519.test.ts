/** @jest-environment node */

import { GET as getSummary } from '@/app/api/organizer/payments/summary/route'
import { GET as getWithdrawals } from '@/app/api/organizer/payments/withdrawals/route'

const mockGetServerSession = jest.fn()
const mockGetOrganizerPaymentsSidebarSummary = jest.fn()
const mockWithdrawalFindMany = jest.fn()

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/organizerPayments', () => ({
  getOrganizerPaymentsSidebarSummary: (...args: unknown[]) =>
    mockGetOrganizerPaymentsSidebarSummary(...args),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    withdrawal: {
      findMany: (...args: unknown[]) => mockWithdrawalFindMany(...args),
    },
  },
}))

describe('Phase 5.19: Organizer Payments Surface & Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/organizer/payments/summary', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const response = await getSummary()
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns authoritative sidebar summary for authenticated organizer', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'org_user_123' } })
      mockGetOrganizerPaymentsSidebarSummary.mockResolvedValue({
        visible: true,
        hasWithdrawableBalance: true,
        badgeCount: 1,
      })

      const response = await getSummary()
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.visible).toBe(true)
      expect(json.hasWithdrawableBalance).toBe(true)
      expect(json.badgeCount).toBe(1)
      expect(mockGetOrganizerPaymentsSidebarSummary).toHaveBeenCalledWith('org_user_123')
    })
  })

  describe('GET /api/organizer/payments/withdrawals', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const response = await getWithdrawals()
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns list of withdrawals for authenticated organizer', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'org_user_123' } })
      mockWithdrawalFindMany.mockResolvedValue([
        {
          id: 'wd_1',
          amount: 1500,
          amountMinorUnits: BigInt(150000),
          currency: 'KES',
          method: 'MPESA',
          destination: '0712345678',
          status: 'COMPLETED',
          providerRef: 'MPESA_REF_123',
          failureReason: null,
          createdAt: new Date('2026-10-20T10:00:00.000Z'),
          settledAt: new Date('2026-10-20T10:05:00.000Z'),
        },
      ])

      const response = await getWithdrawals()
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.withdrawals).toHaveLength(1)
      expect(json.withdrawals[0].id).toBe('wd_1')
      expect(json.withdrawals[0].amount).toBe(1500)
      expect(json.withdrawals[0].status).toBe('COMPLETED')
    })
  })
})
