/** @jest-environment node */

import { ROLE_PERMISSIONS, requireMarketingContext, MarketingRole } from "@/lib/marketing/rbac"
import { getServerSession } from "next-auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}))

jest.mock("@/lib/isAdmin", () => ({
  hasAdminAccess: jest.fn(),
  isAdminEmail: jest.fn(),
  getConfiguredAdminEmails: jest.fn(() => ["superadmin@eventsslot.com"]),
}))

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    marketingTeamMember: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}))

describe("Marketing RBAC - ROLE_PERMISSIONS matrix", () => {
  it("MARKETING_ADMIN has all permissions enabled", () => {
    const admin = ROLE_PERMISSIONS.MARKETING_ADMIN
    expect(admin.canManageTeam).toBe(true)
    expect(admin.canCreateCampaign).toBe(true)
    expect(admin.canEditCampaign).toBe(true)
    expect(admin.canDeleteCampaign).toBe(true)
    expect(admin.canCreateContent).toBe(true)
    expect(admin.canEditContent).toBe(true)
    expect(admin.canApproveContent).toBe(true)
    expect(admin.canScheduleContent).toBe(true)
    expect(admin.canPublishContent).toBe(true)
    expect(admin.canSendBroadcast).toBe(true)
    expect(admin.canManageIntegrations).toBe(true)
    expect(admin.canGenerateLinks).toBe(true)
    expect(admin.canViewAnalytics).toBe(true)
    expect(admin.canGenerateReports).toBe(true)
    expect(admin.canExportReports).toBe(true)
    expect(admin.canManageSettings).toBe(true)
  })

  it("MARKETING_MEMBER cannot manage team, delete campaign, approve/publish content, or broadcast", () => {
    const member = ROLE_PERMISSIONS.MARKETING_MEMBER
    expect(member.canManageTeam).toBe(false)
    expect(member.canDeleteCampaign).toBe(false)
    expect(member.canApproveContent).toBe(false)
    expect(member.canPublishContent).toBe(false)
    expect(member.canSendBroadcast).toBe(false)
    expect(member.canManageIntegrations).toBe(false)
    expect(member.canManageSettings).toBe(false)

    // Allowed actions
    expect(member.canCreateCampaign).toBe(true)
    expect(member.canEditCampaign).toBe(true)
    expect(member.canCreateContent).toBe(true)
    expect(member.canEditContent).toBe(true)
    expect(member.canScheduleContent).toBe(true)
    expect(member.canGenerateLinks).toBe(true)
    expect(member.canViewAnalytics).toBe(true)
    expect(member.canGenerateReports).toBe(true)
    expect(member.canExportReports).toBe(true)
  })

  it("CONTENT_MANAGER only has content and tracking capabilities", () => {
    const cm = ROLE_PERMISSIONS.CONTENT_MANAGER
    expect(cm.canCreateContent).toBe(true)
    expect(cm.canEditContent).toBe(true)
    expect(cm.canScheduleContent).toBe(true)
    expect(cm.canGenerateLinks).toBe(true)
    expect(cm.canViewAnalytics).toBe(true)

    expect(cm.canCreateCampaign).toBe(false)
    expect(cm.canApproveContent).toBe(false)
    expect(cm.canPublishContent).toBe(false)
    expect(cm.canSendBroadcast).toBe(false)
    expect(cm.canGenerateReports).toBe(false)
    expect(cm.canManageTeam).toBe(false)
  })

  it("ANALYST is restricted strictly to read analytics and reports", () => {
    const analyst = ROLE_PERMISSIONS.ANALYST
    expect(analyst.canViewAnalytics).toBe(true)
    expect(analyst.canGenerateReports).toBe(true)
    expect(analyst.canExportReports).toBe(true)

    expect(analyst.canCreateContent).toBe(false)
    expect(analyst.canEditContent).toBe(false)
    expect(analyst.canScheduleContent).toBe(false)
    expect(analyst.canCreateCampaign).toBe(false)
    expect(analyst.canSendBroadcast).toBe(false)
    expect(analyst.canGenerateLinks).toBe(false)
    expect(analyst.canManageTeam).toBe(false)
  })
})

describe("Marketing RBAC - requireMarketingContext guard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 401 when user is not authenticated", async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const result = await requireMarketingContext()
    expect(result.errorResponse).toBeDefined()
    expect(result.errorResponse?.status).toBe(401)
  })

  it("grants full sovereign MARKETING_ADMIN access to Super Admin", async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "admin-1", email: "superadmin@eventsslot.com", name: "Super Admin" },
    })
    ;(hasAdminAccess as jest.Mock).mockReturnValue(true)

    const result = await requireMarketingContext(undefined, "canManageTeam")
    expect(result.errorResponse).toBeUndefined()
    expect(result.context).toBeDefined()
    expect(result.context?.role).toBe("MARKETING_ADMIN")
    expect(result.context?.isSuperAdmin).toBe(true)
    expect(result.context?.permissions.canManageTeam).toBe(true)
  })

  it("returns 401 when authenticated user has no active marketing membership", async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "user-2", email: "random@eventsslot.com", name: "Random User" },
    })
    ;(hasAdminAccess as jest.Mock).mockReturnValue(false)
    ;(prisma.marketingTeamMember.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await requireMarketingContext()
    expect(result.errorResponse).toBeDefined()
    expect(result.errorResponse?.status).toBe(401)
  })

  it("returns 403 when marketing member lacks the required permission", async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "user-3", email: "writer@eventsslot.com", name: "Content Writer" },
    })
    ;(hasAdminAccess as jest.Mock).mockReturnValue(false)
    ;(prisma.marketingTeamMember.findFirst as jest.Mock).mockResolvedValue({
      id: "mem-1",
      userId: "user-3",
      email: "writer@eventsslot.com",
      name: "Content Writer",
      role: "CONTENT_MANAGER" as MarketingRole,
      status: "ACTIVE",
    })
    ;(prisma.marketingTeamMember.update as jest.Mock).mockResolvedValue({})

    // CONTENT_MANAGER does NOT have canSendBroadcast
    const result = await requireMarketingContext(undefined, "canSendBroadcast")
    expect(result.errorResponse).toBeDefined()
    expect(result.errorResponse?.status).toBe(403)
  })

  it("returns context successfully when user has the required permission", async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "user-4", email: "mkt@eventsslot.com", name: "Marketing Lead" },
    })
    ;(hasAdminAccess as jest.Mock).mockReturnValue(false)
    ;(prisma.marketingTeamMember.findFirst as jest.Mock).mockResolvedValue({
      id: "mem-2",
      userId: "user-4",
      email: "mkt@eventsslot.com",
      name: "Marketing Lead",
      role: "MARKETING_MEMBER" as MarketingRole,
      status: "ACTIVE",
    })
    ;(prisma.marketingTeamMember.update as jest.Mock).mockResolvedValue({})

    const result = await requireMarketingContext(undefined, "canCreateCampaign")
    expect(result.errorResponse).toBeUndefined()
    expect(result.context?.role).toBe("MARKETING_MEMBER")
    expect(result.context?.permissions.canCreateCampaign).toBe(true)
  })
})
