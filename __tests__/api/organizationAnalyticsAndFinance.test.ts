/** @jest-environment node */

import { GET as getAnalytics } from '@/app/api/organizations/[handle]/analytics/route'
import { GET as getFinance, PATCH as updateFinance } from '@/app/api/organizations/[handle]/finance/route'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  organization: {
    findUnique: jest.fn(),
  },
  organizationMember: {
    findUnique: jest.fn(),
  },
  organizationFinanceProfile: {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  organizationAuditLog: {
    create: jest.fn(),
  },
  event: {
    findMany: jest.fn(),
  },
}))

describe('Organization Analytics & Financial Governance API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/organizations/[handle]/analytics', () => {
    it('returns 401 when unauthenticated', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety/analytics')
      const res = await getAnalytics(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(401)
    })

    it('aggregates metrics across organization events for active member', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_em', email: 'em@example.com' },
      })
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_society',
        name: 'I Speak Society',
        handle: 'ispeaksociety',
        _count: { followers: 120 },
      })
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'mem_1',
        role: 'EVENT_MANAGER',
        status: 'ACTIVE',
      })
      ;(prisma.event.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'ev_1',
          title: 'Convention 1',
          slug: 'conv-1',
          status: 'active',
          eventDate: new Date(),
          confirmedCount: 50,
          waitlistCount: 5,
          capacity: 100,
          isPaid: false,
          _count: { registrations: 45 },
        },
        {
          id: 'ev_2',
          title: 'Convention 2',
          slug: 'conv-2',
          status: 'active',
          eventDate: new Date(),
          confirmedCount: 30,
          waitlistCount: 2,
          capacity: 50,
          isPaid: false,
          _count: { registrations: 28 },
        },
      ])

      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety/analytics')
      const res = await getAnalytics(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.metrics.totalEvents).toBe(2)
      expect(data.metrics.totalRegistrations).toBe(80)
      expect(data.metrics.totalWaitlist).toBe(7)
      expect(data.metrics.totalCheckins).toBe(73)
      expect(data.metrics.followerCount).toBe(120)
    })
  })

  describe('Financial Governance API', () => {
    it('strictly denies financial summary access to Event Managers and Admins', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_em', email: 'em@example.com' },
      })
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_society',
        name: 'I Speak Society',
        handle: 'ispeaksociety',
      })
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'mem_1',
        role: 'EVENT_MANAGER',
        status: 'ACTIVE',
      })

      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety/finance')
      const res = await getFinance(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toContain('does not possess permission view_finance_summary')
    })

    it('returns UNCONFIGURED status and disabled payouts for Owner', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_owner', email: 'owner@example.com' },
      })
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_society',
        name: 'I Speak Society',
        handle: 'ispeaksociety',
      })
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'mem_owner',
        role: 'OWNER',
        status: 'ACTIVE',
      })
      ;(prisma.organizationFinanceProfile.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'fin_1',
        status: 'UNCONFIGURED',
        currency: 'KES',
        beneficiaryName: null,
        payoutMethod: null,
        settlementNotes: null,
      })

      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety/finance')
      const res = await getFinance(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.financeProfile.status).toBe('UNCONFIGURED')
      expect(data.financeProfile.payoutsEnabled).toBe(false)
      expect(data.financeProfile.notice).toContain('Payout execution remains disabled until provider onboarding is approved')
    })

    it('transitions settlement config to PENDING_REVIEW without faking live payouts', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_owner', email: 'owner@example.com' },
      })
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_society',
        name: 'I Speak Society',
      })
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'mem_owner',
        role: 'OWNER',
        status: 'ACTIVE',
      })
      ;(prisma.organizationFinanceProfile.upsert as jest.Mock).mockResolvedValueOnce({
        id: 'fin_1',
        organizationId: 'org_society',
        status: 'PENDING_REVIEW',
        beneficiaryName: 'I Speak Society Trust',
        payoutMethod: 'BANK',
      })

      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety/finance', {
        method: 'PATCH',
        body: JSON.stringify({
          beneficiaryName: 'I Speak Society Trust',
          payoutMethod: 'BANK',
        }),
      })

      const res = await updateFinance(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.financeProfile.status).toBe('PENDING_REVIEW')
      expect(data.message).toContain('Live payouts remain disabled until provider verification')
    })
  })
})
