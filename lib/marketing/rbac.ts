import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"
import { NextRequest, NextResponse } from "next/server"
import type { MarketingRole, MarketingMemberStatus } from "@prisma/client"

export type { MarketingRole, MarketingMemberStatus }

export interface MarketingPermissions {
  canManageTeam: boolean
  canCreateCampaign: boolean
  canEditCampaign: boolean
  canDeleteCampaign: boolean
  canCreateContent: boolean
  canEditContent: boolean
  canApproveContent: boolean
  canScheduleContent: boolean
  canPublishContent: boolean
  canSendBroadcast: boolean
  canManageIntegrations: boolean
  canGenerateLinks: boolean
  canViewAnalytics: boolean
  canGenerateReports: boolean
  canExportReports: boolean
  canManageSettings: boolean
}

export const ROLE_PERMISSIONS: Record<MarketingRole, MarketingPermissions> = {
  MARKETING_ADMIN: {
    canManageTeam: true,
    canCreateCampaign: true,
    canEditCampaign: true,
    canDeleteCampaign: true,
    canCreateContent: true,
    canEditContent: true,
    canApproveContent: true,
    canScheduleContent: true,
    canPublishContent: true,
    canSendBroadcast: true,
    canManageIntegrations: true,
    canGenerateLinks: true,
    canViewAnalytics: true,
    canGenerateReports: true,
    canExportReports: true,
    canManageSettings: true,
  },
  MARKETING_MEMBER: {
    canManageTeam: false,
    canCreateCampaign: true,
    canEditCampaign: true,
    canDeleteCampaign: false,
    canCreateContent: true,
    canEditContent: true,
    canApproveContent: false,
    canScheduleContent: true,
    canPublishContent: false,
    canSendBroadcast: false,
    canManageIntegrations: false,
    canGenerateLinks: true,
    canViewAnalytics: true,
    canGenerateReports: true,
    canExportReports: true,
    canManageSettings: false,
  },
  CONTENT_MANAGER: {
    canManageTeam: false,
    canCreateCampaign: false,
    canEditCampaign: false,
    canDeleteCampaign: false,
    canCreateContent: true,
    canEditContent: true,
    canApproveContent: false,
    canScheduleContent: true,
    canPublishContent: false,
    canSendBroadcast: false,
    canManageIntegrations: false,
    canGenerateLinks: true,
    canViewAnalytics: true,
    canGenerateReports: false,
    canExportReports: false,
    canManageSettings: false,
  },
  ANALYST: {
    canManageTeam: false,
    canCreateCampaign: false,
    canEditCampaign: false,
    canDeleteCampaign: false,
    canCreateContent: false,
    canEditContent: false,
    canApproveContent: false,
    canScheduleContent: false,
    canPublishContent: false,
    canSendBroadcast: false,
    canManageIntegrations: false,
    canGenerateLinks: false,
    canViewAnalytics: true,
    canGenerateReports: true,
    canExportReports: true,
    canManageSettings: false,
  },
}

export interface MarketingUserContext {
  userId: string
  email: string
  name: string
  role: MarketingRole
  status: MarketingMemberStatus
  isSuperAdmin: boolean
  permissions: MarketingPermissions
  memberRecordId?: string
}

export async function getMarketingContext(
  req?: NextRequest
): Promise<MarketingUserContext | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return null
  }

  const userId = session.user.id
  const email = session.user.email.trim().toLowerCase()
  const name = session.user.name || "Marketing User"
  const isSuperAdmin =
    hasAdminAccess(session) ||
    email === "eventslot.co@gmail.com" ||
    email === "eventslot.co" ||
    email.startsWith("eventslot.co@")

  // Super Admin always has sovereign Marketing Admin permissions
  if (isSuperAdmin) {
    return {
      userId,
      email,
      name,
      role: "MARKETING_ADMIN",
      status: "ACTIVE",
      isSuperAdmin: true,
      permissions: ROLE_PERMISSIONS.MARKETING_ADMIN,
    }
  }

  // Look up active marketing team membership
  const member = await prisma.marketingTeamMember.findFirst({
    where: {
      OR: [
        { userId },
        { email: { equals: email, mode: "insensitive" } },
      ],
      status: "ACTIVE",
    },
  })

  if (!member) {
    return null
  }

  // If user wasn't previously linked, link now
  if (!member.userId) {
    await prisma.marketingTeamMember.update({
      where: { id: member.id },
      data: { userId, joinedAt: member.joinedAt ?? new Date(), lastActiveAt: new Date() },
    })
  } else {
    // Touch last active
    await prisma.marketingTeamMember.update({
      where: { id: member.id },
      data: { lastActiveAt: new Date() },
    })
  }

  const role = member.role as MarketingRole
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.MARKETING_MEMBER

  return {
    userId,
    email,
    name: member.name || name,
    role,
    status: member.status,
    isSuperAdmin: false,
    permissions,
    memberRecordId: member.id,
  }
}

export async function requireMarketingContext(
  req?: NextRequest,
  requiredPermission?: keyof MarketingPermissions
): Promise<
  | { context: MarketingUserContext; errorResponse?: never }
  | { context?: never; errorResponse: NextResponse }
> {
  const context = await getMarketingContext(req)

  if (!context) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized. Marketing Hub access required." },
        { status: 401 }
      ),
    }
  }

  if (requiredPermission && !context.permissions[requiredPermission]) {
    return {
      errorResponse: NextResponse.json(
        {
          error: `Forbidden. You lack '${requiredPermission}' permission.`,
          requiredPermission,
          role: context.role,
        },
        { status: 403 }
      ),
    }
  }

  return { context }
}
