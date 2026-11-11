/** @jest-environment node */

import { POST as createOrg } from '@/app/api/organizations/route'
import { GET as getOrg, PATCH as updateOrg } from '@/app/api/organizations/[handle]/route'
import { POST as publishOrg } from '@/app/api/organizations/[handle]/publish/route'
import { POST as createInvite } from '@/app/api/organizations/[handle]/invitations/route'
import { GET as getInvite } from '@/app/api/invitations/[token]/route'
import { POST as acceptInvite } from '@/app/api/invitations/[token]/accept/route'
import { DELETE as removeMember } from '@/app/api/organizations/[handle]/members/[memberId]/route'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { hashToken } from '@/lib/invitationToken'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  organization: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  organizationMember: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  },
  organizationInvitation: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  organizationFinanceProfile: {
    create: jest.fn(),
  },
  organizationAuditLog: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(prisma)),
}))

describe('Organization Workspaces & Invitations Lifecycle API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/organizations', () => {
    it('returns 401 when unauthenticated', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
      const req = new NextRequest('http://localhost:3000/api/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Acme' }),
      })
      const res = await createOrg(req)
      expect(res.status).toBe(401)
    })

    it('rejects reserved system handles', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_1', email: 'owner@example.com' },
      })
      const req = new NextRequest('http://localhost:3000/api/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Admin Org', handle: 'admin' }),
      })
      const res = await createOrg(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('reserved system path')
    })

    it('creates organization in DRAFT state and assigns caller as OWNER', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_1', email: 'owner@example.com' },
      })
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(null)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null)

      const createdOrgRecord = {
        id: 'org_iss',
        name: 'I Speak Society',
        handle: 'ispeaksociety',
        publicationStatus: 'DRAFT',
        verificationStatus: 'UNVERIFIED',
      }
      ;(prisma.organization.create as jest.Mock).mockResolvedValueOnce(createdOrgRecord)

      const req = new NextRequest('http://localhost:3000/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'I Speak Society',
          handle: 'ispeaksociety',
          description: 'A global public speaking community',
        }),
      })

      const res = await createOrg(req)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.organization.handle).toBe('ispeaksociety')
      expect(data.organization.role).toBe('OWNER')
    })
  })

  describe('GET /api/organizations/[handle]', () => {
    it('returns 404 for unpublished organizations when accessed by non-members', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_iss',
        name: 'I Speak Society',
        handle: 'ispeaksociety',
        publicationStatus: 'DRAFT',
        _count: { members: 1, events: 0, followers: 0 },
      })

      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety')
      const res = await getOrg(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(404)
    })

    it('returns public profile for published organization to visitors', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_iss',
        name: 'I Speak Society',
        handle: 'ispeaksociety',
        publicationStatus: 'PUBLISHED',
        verificationStatus: 'VERIFIED',
        _count: { members: 3, events: 5, followers: 120 },
      })

      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety')
      const res = await getOrg(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.organization.name).toBe('I Speak Society')
      expect(data.organization.followerCount).toBe(120)
      expect(data.organization.isMember).toBe(false)
    })
  })

  describe('Invitations & Acceptance', () => {
    it('rejects invitation creation with OWNER role', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_owner', email: 'owner@example.com' },
      })
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_1',
        name: 'Acme',
      })
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'mem_1',
        role: 'OWNER',
        status: 'ACTIVE',
      })

      const req = new NextRequest('http://localhost:3000/api/organizations/acme/invitations', {
        method: 'POST',
        body: JSON.stringify({ type: 'LINK', role: 'OWNER' }),
      })

      const res = await createInvite(req, { params: Promise.resolve({ handle: 'acme' }) })
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toContain('Owner role cannot be granted via invitation')
    })

    it('accepts valid invitation and upserts member with ACTIVE status', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_invitee', email: 'sarah@example.com' },
      })

      const fakeToken = 'secret-raw-token-12345'
      const hashed = hashToken(fakeToken)

      ;(prisma.organizationInvitation.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'inv_1',
        organizationId: 'org_1',
        tokenHash: hashed,
        role: 'EVENT_MANAGER',
        type: 'LINK',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        usesCount: 0,
        maxUses: 5,
        organization: { id: 'org_1', name: 'I Speak Society', handle: 'ispeaksociety' },
      })

      const req = new NextRequest(`http://localhost:3000/api/invitations/${fakeToken}/accept`, {
        method: 'POST',
      })

      const res = await acceptInvite(req, { params: Promise.resolve({ token: fakeToken }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.organization.handle).toBe('ispeaksociety')
      expect(data.organization.role).toBe('EVENT_MANAGER')
    })
  })

  describe('Member Management Safeguards', () => {
    it('prevents removing the last active Owner', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_owner', email: 'owner@example.com' },
      })
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_1',
      })
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'mem_owner',
        role: 'OWNER',
        status: 'ACTIVE',
      })
      ;(prisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'mem_target_owner',
        role: 'OWNER',
        status: 'ACTIVE',
      })
      ;(prisma.organizationMember.count as jest.Mock).mockResolvedValueOnce(1) // Only 1 owner remains

      const req = new NextRequest('http://localhost:3000/api/organizations/acme/members/mem_target_owner', {
        method: 'DELETE',
      })

      const res = await removeMember(req, { params: Promise.resolve({ handle: 'acme', memberId: 'mem_target_owner' }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('Cannot remove the last remaining Owner')
    })
  })
})
