/** @jest-environment node */

import { GET } from '@/app/api/me/workspaces/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    organizationMember: {
      findMany: jest.fn(),
    },
    teamMember: {
      findMany: jest.fn(),
    },
  },
}))

describe('GET /api/me/workspaces', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns personal account and organizations user is member of', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({
      user: { id: 'user_1', email: 'john@example.com' },
    })

    ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'user_1',
      name: 'John Doe',
      username: 'johndoe',
      email: 'john@example.com',
      image: null,
    })

    ;(prisma.organizationMember.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.teamMember.findMany as jest.Mock).mockResolvedValueOnce([
      {
        owner: {
          id: 'org_1',
          name: 'Acme Corp',
          username: 'acmecorp',
          email: 'contact@acme.com',
          image: null,
        },
      },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.personal.id).toBe('user_1')
    expect(data.personal.username).toBe('johndoe')
    expect(data.organizations).toHaveLength(1)
    expect(data.organizations[0].name).toBe('Acme Corp')
    expect(data.organizations[0].username).toBe('acmecorp')
  })

  it('returns first-class organization workspaces with roles', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce({
      user: { id: 'user_2', email: 'sarah@example.com' },
    })

    ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'user_2',
      name: 'Sarah Connor',
      username: 'sarahc',
      email: 'sarah@example.com',
      image: null,
    })

    ;(prisma.organizationMember.findMany as jest.Mock).mockResolvedValueOnce([
      {
        role: 'OWNER',
        organization: {
          id: 'org_society',
          name: 'I Speak Society',
          handle: 'ispeaksociety',
          logo: '/logos/iss.png',
          publicationStatus: 'PUBLISHED',
          verificationStatus: 'VERIFIED',
          contactEmail: 'hello@ispeaksociety.com',
        },
      },
    ])
    ;(prisma.teamMember.findMany as jest.Mock).mockResolvedValueOnce([])

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.organizations).toHaveLength(1)
    expect(data.organizations[0].id).toBe('org_society')
    expect(data.organizations[0].name).toBe('I Speak Society')
    expect(data.organizations[0].handle).toBe('ispeaksociety')
    expect(data.organizations[0].role).toBe('OWNER')
    expect(data.organizations[0].verificationStatus).toBe('VERIFIED')
  })
})
