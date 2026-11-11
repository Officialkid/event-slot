import prisma from '@/lib/prisma'
import { OrganizationRole, OrganizationMemberStatus } from '@prisma/client'

export type OrganizationPermission =
  | 'view_org'
  | 'edit_org_profile'
  | 'publish_org_profile'
  | 'view_members'
  | 'invite_members'
  | 'revoke_invites'
  | 'remove_members'
  | 'change_member_role'
  | 'transfer_ownership'
  | 'view_all_events'
  | 'create_event'
  | 'edit_event'
  | 'publish_event'
  | 'cancel_event'
  | 'transfer_event'
  | 'view_registration_counts'
  | 'view_attendee_details'
  | 'export_attendee_list'
  | 'perform_checkin'
  | 'manage_verifier_access'
  | 'view_org_analytics'
  | 'export_org_reports'
  | 'view_audit_log'
  | 'view_finance_summary'
  | 'configure_settlement'

const OWNER_PERMISSIONS: OrganizationPermission[] = [
  'view_org',
  'edit_org_profile',
  'publish_org_profile',
  'view_members',
  'invite_members',
  'revoke_invites',
  'remove_members',
  'change_member_role',
  'transfer_ownership',
  'view_all_events',
  'create_event',
  'edit_event',
  'publish_event',
  'cancel_event',
  'transfer_event',
  'view_registration_counts',
  'view_attendee_details',
  'export_attendee_list',
  'perform_checkin',
  'manage_verifier_access',
  'view_org_analytics',
  'export_org_reports',
  'view_audit_log',
  'view_finance_summary',
  'configure_settlement',
]

const ADMIN_PERMISSIONS: OrganizationPermission[] = [
  'view_org',
  'edit_org_profile',
  'view_members',
  'invite_members',
  'revoke_invites',
  'remove_members',
  'change_member_role',
  'view_all_events',
  'create_event',
  'edit_event',
  'publish_event',
  'cancel_event',
  'view_registration_counts',
  'view_attendee_details',
  'export_attendee_list',
  'perform_checkin',
  'manage_verifier_access',
  'view_org_analytics',
  'export_org_reports',
  'view_audit_log',
]

const EVENT_MANAGER_PERMISSIONS: OrganizationPermission[] = [
  'view_org',
  'view_members',
  'view_all_events',
  'create_event',
  'edit_event',
  'publish_event',
  'view_registration_counts',
  'perform_checkin',
  'manage_verifier_access',
  'view_org_analytics',
]

export const ROLE_PERMISSIONS: Record<OrganizationRole, OrganizationPermission[]> = {
  OWNER: OWNER_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  EVENT_MANAGER: EVENT_MANAGER_PERMISSIONS,
}

export function roleHasPermission(role: OrganizationRole, permission: OrganizationPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permission)
}

export interface CheckOrgPermissionParams {
  userId: string
  organizationId: string
  permission: OrganizationPermission
}

export interface CheckOrgPermissionResult {
  allowed: boolean
  role?: OrganizationRole
  membershipId?: string
  reason?: string
}

/**
 * Authoritative server-side evaluation of an actor's permission in an organization.
 * Revalidates database membership status (must be ACTIVE).
 */
export async function checkOrgPermission({
  userId,
  organizationId,
  permission,
}: CheckOrgPermissionParams): Promise<CheckOrgPermissionResult> {
  if (!userId || !organizationId) {
    return { allowed: false, reason: 'Missing user or organization identifier' }
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: {
      id: true,
      role: true,
      status: true,
    },
  })

  if (!membership) {
    return { allowed: false, reason: 'User is not a member of this organization' }
  }

  if (membership.status !== OrganizationMemberStatus.ACTIVE) {
    return { allowed: false, reason: `Organization membership is ${membership.status.toLowerCase()}` }
  }

  const allowed = roleHasPermission(membership.role, permission)
  if (!allowed) {
    return {
      allowed: false,
      role: membership.role,
      membershipId: membership.id,
      reason: `Role ${membership.role} does not possess permission ${permission}`,
    }
  }

  return {
    allowed: true,
    role: membership.role,
    membershipId: membership.id,
  }
}

/**
 * Reserved handles that cannot be registered as organization slugs
 */
export const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'billing',
  'careers',
  'community',
  'create',
  'dashboard',
  'docs',
  'events',
  'feedback',
  'help',
  'insights',
  'invite',
  'login',
  'marketing',
  'my-events',
  'notifications',
  'org',
  'organization',
  'organizations',
  'payments',
  'pricing',
  'privacy',
  'profile',
  'register',
  'settings',
  'signin',
  'signup',
  'support',
  'team',
  'terms',
  'verify',
  'verify-tickets',
  'workspace',
])

export function normalizeOrgHandle(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function validateOrgHandle(handle: string): { valid: boolean; error?: string } {
  const normalized = normalizeOrgHandle(handle)
  if (!normalized || normalized.length < 3) {
    return { valid: false, error: 'Organization handle must be at least 3 characters long.' }
  }
  if (normalized.length > 40) {
    return { valid: false, error: 'Organization handle cannot exceed 40 characters.' }
  }
  if (RESERVED_HANDLES.has(normalized)) {
    return { valid: false, error: `Handle "${normalized}" is a reserved system path.` }
  }
  return { valid: true }
}
