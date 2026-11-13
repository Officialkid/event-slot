/** @jest-environment node */

import {
  roleHasPermission,
  normalizeOrgHandle,
  validateOrgHandle,
  checkOrgPermission,
  RESERVED_HANDLES,
} from '@/lib/organizationPermissions'
import prisma from '@/lib/prisma'
import { OrganizationRole, OrganizationMemberStatus } from '@prisma/client'

jest.mock('@/lib/prisma', () => ({
  organizationMember: {
    findUnique: jest.fn(),
  },
}))

describe('Organization Permissions & Policy Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('roleHasPermission', () => {
    it('grants Owner all critical governance and finance permissions', () => {
      expect(roleHasPermission(OrganizationRole.OWNER, 'publish_org_profile')).toBe(true)
      expect(roleHasPermission(OrganizationRole.OWNER, 'transfer_ownership')).toBe(true)
      expect(roleHasPermission(OrganizationRole.OWNER, 'export_attendee_list')).toBe(true)
      expect(roleHasPermission(OrganizationRole.OWNER, 'view_finance_summary')).toBe(true)
      expect(roleHasPermission(OrganizationRole.OWNER, 'configure_settlement')).toBe(true)
      expect(roleHasPermission(OrganizationRole.OWNER, 'create_event')).toBe(true)
    })

    it('grants Admin event and member management but denies Owner governance and finance', () => {
      expect(roleHasPermission(OrganizationRole.ADMIN, 'create_event')).toBe(true)
      expect(roleHasPermission(OrganizationRole.ADMIN, 'invite_members')).toBe(true)
      expect(roleHasPermission(OrganizationRole.ADMIN, 'export_attendee_list')).toBe(true)
      // Restricted from Owner-only governance
      expect(roleHasPermission(OrganizationRole.ADMIN, 'publish_org_profile')).toBe(false)
      expect(roleHasPermission(OrganizationRole.ADMIN, 'transfer_ownership')).toBe(false)
      expect(roleHasPermission(OrganizationRole.ADMIN, 'view_finance_summary')).toBe(false)
      expect(roleHasPermission(OrganizationRole.ADMIN, 'configure_settlement')).toBe(false)
    })

    it('grants Event Manager operational permissions but strictly denies attendee exports, member admin and finance', () => {
      expect(roleHasPermission(OrganizationRole.EVENT_MANAGER, 'view_all_events')).toBe(true)
      expect(roleHasPermission(OrganizationRole.EVENT_MANAGER, 'create_event')).toBe(true)
      expect(roleHasPermission(OrganizationRole.EVENT_MANAGER, 'edit_event')).toBe(true)
      expect(roleHasPermission(OrganizationRole.EVENT_MANAGER, 'perform_checkin')).toBe(true)
      expect(roleHasPermission(OrganizationRole.EVENT_MANAGER, 'view_registration_counts')).toBe(true)

      // Strict boundaries
      expect(roleHasPermission(OrganizationRole.EVENT_MANAGER, 'export_attendee_list')).toBe(false)
      expect(roleHasPermission(OrganizationRole.EVENT_MANAGER, 'invite_members')).toBe(false)
      expect(roleHasPermission(OrganizationRole.EVENT_MANAGER, 'remove_members')).toBe(false)
      expect(roleHasPermission(OrganizationRole.EVENT_MANAGER, 'publish_org_profile')).toBe(false)
      expect(roleHasPermission(OrganizationRole.EVENT_MANAGER, 'view_finance_summary')).toBe(false)
      expect(roleHasPermission(OrganizationRole.EVENT_MANAGER, 'configure_settlement')).toBe(false)
    })
  })

  describe('Handle Normalization & Validation', () => {
    it('normalizes uppercase, spaces, symbols, and consecutive dashes', () => {
      expect(normalizeOrgHandle('I Speak Society!')).toBe('i-speak-society')
      expect(normalizeOrgHandle('  The---Disruptors___Movement  ')).toBe('the-disruptors-movement')
      expect(normalizeOrgHandle('EventSlot@2026#Global')).toBe('eventslot-2026-global')
    })

    it('validates handle length constraints', () => {
      expect(validateOrgHandle('ab').valid).toBe(false)
      expect(validateOrgHandle('ab').error).toContain('at least 3 characters')

      const longHandle = 'a'.repeat(45)
      expect(validateOrgHandle(longHandle).valid).toBe(false)
      expect(validateOrgHandle(longHandle).error).toContain('cannot exceed 40 characters')

      expect(validateOrgHandle('ispeaksociety').valid).toBe(true)
    })

    it('blocks reserved system handles', () => {
      for (const reserved of Array.from(RESERVED_HANDLES).slice(0, 5)) {
        const check = validateOrgHandle(reserved)
        expect(check.valid).toBe(false)
        expect(check.error).toContain('reserved system path')
      }
    })
  })

  describe('checkOrgPermission database evaluator', () => {
    it('denies access if user is not in the organization', async () => {
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce(null)

      const result = await checkOrgPermission({
        userId: 'user_intruder',
        organizationId: 'org_society',
        permission: 'view_all_events',
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('not a member')
    })

    it('denies access if user membership is SUSPENDED or REMOVED', async () => {
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'mem_1',
        role: OrganizationRole.ADMIN,
        status: OrganizationMemberStatus.SUSPENDED,
      })

      const result = await checkOrgPermission({
        userId: 'user_suspended',
        organizationId: 'org_society',
        permission: 'view_all_events',
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('suspended')
    })

    it('allows access when active member has permitted role', async () => {
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'mem_2',
        role: OrganizationRole.EVENT_MANAGER,
        status: OrganizationMemberStatus.ACTIVE,
      })

      const result = await checkOrgPermission({
        userId: 'user_manager',
        organizationId: 'org_society',
        permission: 'create_event',
      })

      expect(result.allowed).toBe(true)
      expect(result.role).toBe(OrganizationRole.EVENT_MANAGER)
      expect(result.membershipId).toBe('mem_2')
    })

    it('denies unprivileged action for active member with helpful reason', async () => {
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'mem_3',
        role: OrganizationRole.EVENT_MANAGER,
        status: OrganizationMemberStatus.ACTIVE,
      })

      const result = await checkOrgPermission({
        userId: 'user_manager',
        organizationId: 'org_society',
        permission: 'export_attendee_list',
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('does not possess permission export_attendee_list')
    })
  })
})
