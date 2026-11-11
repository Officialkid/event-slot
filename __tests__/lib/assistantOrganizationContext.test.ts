/** @jest-environment node */

import {
  verifyWorkspaceMembership,
  authorizeEventRecordAccess,
  type AssistantActorContext,
} from '@/lib/assistant/context-resolver'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => {
  const mockDb = {
    user: {
      findUnique: jest.fn(),
    },
    organizationMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    teamMember: {
      findFirst: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
  }
  return {
    __esModule: true,
    default: mockDb,
    prisma: mockDb,
  }
})

describe('ESA Organization Context & Authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('verifyWorkspaceMembership', () => {
    it('allows personal workspace access when workspace matches actor userId', async () => {
      const actor: AssistantActorContext = {
        userId: 'user_1',
        workspaceOrganizerId: 'user_1',
      }

      const result = await verifyWorkspaceMembership(actor)
      expect(result.allowed).toBe(true)
    })

    it('allows active member operating within an organization workspace', async () => {
      ;(prisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'mem_1',
        role: 'EVENT_MANAGER',
      })

      const actor: AssistantActorContext = {
        userId: 'user_em',
        workspaceOrganizerId: 'org_society',
      }

      const result = await verifyWorkspaceMembership(actor)
      expect(result.allowed).toBe(true)
      expect(prisma.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user_em',
          status: 'ACTIVE',
          organization: {
            OR: [
              { id: 'org_society' },
              { handle: 'org_society' },
            ],
          },
        },
        select: { id: true, role: true },
      })
    })

    it('rejects user with no active membership in organization workspace', async () => {
      ;(prisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce(null)
      ;(prisma.teamMember.findFirst as jest.Mock).mockResolvedValueOnce(null)

      const actor: AssistantActorContext = {
        userId: 'user_outsider',
        workspaceOrganizerId: 'org_society',
      }

      const result = await verifyWorkspaceMembership(actor)
      expect(result.allowed).toBe(false)
    })
  })

  describe('authorizeEventRecordAccess', () => {
    it('authorizes organization event for active Owner as accessRole owner', async () => {
      ;(prisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'mem_owner',
        role: 'OWNER',
      })
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        role: 'OWNER',
        status: 'ACTIVE',
      })

      const actor: AssistantActorContext = {
        userId: 'user_owner',
        workspaceOrganizerId: 'org_society',
      }

      const rawEvent = {
        id: 'ev_iss_1',
        slug: 'speech-and-pitch',
        title: 'Speech and Pitch',
        status: 'active',
        visibility: 'PUBLIC',
        eventType: 'PHYSICAL',
        organizerId: 'user_founder',
        organizationId: 'org_society',
        capacity: 100,
        confirmedCount: 50,
        waitlistCount: 0,
        eventDate: new Date(),
        deadline: null,
        location: 'Nairobi',
        ticketsEnabled: true,
        isPaid: false,
        archived: false,
        createdAt: new Date(),
      }

      const result = await authorizeEventRecordAccess(actor, rawEvent)
      expect(result.allowed).toBe(true)
      expect(result.accessRole).toBe('owner')
    })

    it('authorizes organization event for active Event Manager as accessRole team_member', async () => {
      ;(prisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'mem_em',
        role: 'EVENT_MANAGER',
      })
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        role: 'EVENT_MANAGER',
        status: 'ACTIVE',
      })

      const actor: AssistantActorContext = {
        userId: 'user_em',
        workspaceOrganizerId: 'org_society',
      }

      const rawEvent = {
        id: 'ev_iss_1',
        slug: 'speech-and-pitch',
        title: 'Speech and Pitch',
        status: 'active',
        visibility: 'PUBLIC',
        eventType: 'PHYSICAL',
        organizerId: 'user_founder',
        organizationId: 'org_society',
        capacity: 100,
        confirmedCount: 50,
        waitlistCount: 0,
        eventDate: new Date(),
        deadline: null,
        location: 'Nairobi',
        ticketsEnabled: true,
        isPaid: false,
        archived: false,
        createdAt: new Date(),
      }

      const result = await authorizeEventRecordAccess(actor, rawEvent)
      expect(result.allowed).toBe(true)
      expect(result.accessRole).toBe('team_member')
    })
  })
})
