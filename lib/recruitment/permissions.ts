import type { Session } from "next-auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"

export interface RecruitmentAccessCheckOptions {
  vacancyId?: string
  applicationId?: string
  requireAdmin?: boolean // True for managing vacancies or managing other reviewers
}

export interface RecruitmentAccessResult {
  authorized: boolean
  isGlobalAdmin: boolean
  isReviewer: boolean
  role: "GLOBAL_ADMIN" | "HIRING_MANAGER" | "REVIEWER" | "HR_CONSULTANT" | null
  userId?: string
  userEmail?: string
  error?: string
}

/**
 * Checks server-side permissions for recruitment actions.
 * Enforces least-privilege, vacancy/application scoping, expiration, and revocation.
 */
export async function checkRecruitmentAccess(
  session: Session | null | undefined,
  options: RecruitmentAccessCheckOptions = {}
): Promise<RecruitmentAccessResult> {
  if (!session?.user) {
    return {
      authorized: false,
      isGlobalAdmin: false,
      isReviewer: false,
      role: null,
      error: "Authentication required",
    }
  }

  const userId = session.user.id
  const userEmail = session.user.email ?? undefined

  // 1. Global Admin Check: Full, unrestricted recruitment access
  const userRole = (session.user as any)?.role
  if (hasAdminAccess(session) || userRole === "ADMIN" || userRole === "SUPER_ADMIN") {
    return {
      authorized: true,
      isGlobalAdmin: true,
      isReviewer: false,
      role: "GLOBAL_ADMIN",
      userId,
      userEmail,
    }
  }

  // If action strictly requires global admin rights (e.g. managing reviewers, publishing/deleting vacancies)
  if (options.requireAdmin) {
    return {
      authorized: false,
      isGlobalAdmin: false,
      isReviewer: false,
      role: null,
      userId,
      userEmail,
      error: "Administrative recruitment privileges required",
    }
  }

  if (!userId) {
    return {
      authorized: false,
      isGlobalAdmin: false,
      isReviewer: false,
      role: null,
      error: "User identity missing",
    }
  }

  // 2. Temporary Reviewer Check
  const now = new Date()

  // Find active, unrevoked, unexpired assignments for this user
  const activeAssignments = await prisma.recruitmentReviewerAssignment.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  })

  if (!activeAssignments || activeAssignments.length === 0) {
    return {
      authorized: false,
      isGlobalAdmin: false,
      isReviewer: false,
      role: null,
      userId,
      userEmail,
      error: "No active reviewer assignment or assignment has expired/been revoked",
    }
  }

  // If a specific vacancy is requested
  if (options.vacancyId) {
    const matchingVacancyAssignment = activeAssignments.find(
      (a) => !a.vacancyId || a.vacancyId === options.vacancyId
    )

    if (!matchingVacancyAssignment) {
      return {
        authorized: false,
        isGlobalAdmin: false,
        isReviewer: true,
        role: null,
        userId,
        userEmail,
        error: "Not assigned to this vacancy",
      }
    }

    return {
      authorized: true,
      isGlobalAdmin: false,
      isReviewer: true,
      role: matchingVacancyAssignment.role as "HIRING_MANAGER" | "REVIEWER" | "HR_CONSULTANT",
      userId,
      userEmail,
    }
  }

  // If a specific application is requested
  if (options.applicationId) {
    // Look up the application to get its vacancyId
    const application = await prisma.jobApplication.findUnique({
      where: { id: options.applicationId },
      select: { id: true, vacancyId: true },
    })

    if (!application) {
      return {
        authorized: false,
        isGlobalAdmin: false,
        isReviewer: true,
        role: null,
        userId,
        userEmail,
        error: "Application not found",
      }
    }

    const matchingAppAssignment = activeAssignments.find((a) => {
      // Direct application match
      if (a.applicationId === application.id) return true
      // Vacancy-level match
      if (a.vacancyId === application.vacancyId) return true
      // Broad recruitment match
      if (!a.vacancyId && !a.applicationId) return true
      return false
    })

    if (!matchingAppAssignment) {
      return {
        authorized: false,
        isGlobalAdmin: false,
        isReviewer: true,
        role: null,
        userId,
        userEmail,
        error: "Not assigned to this candidate application",
      }
    }

    return {
      authorized: true,
      isGlobalAdmin: false,
      isReviewer: true,
      role: matchingAppAssignment.role as "HIRING_MANAGER" | "REVIEWER" | "HR_CONSULTANT",
      userId,
      userEmail,
    }
  }

  // General reviewer access (e.g. browsing assigned overview)
  const primaryRole = activeAssignments[0].role as "HIRING_MANAGER" | "REVIEWER" | "HR_CONSULTANT"

  return {
    authorized: true,
    isGlobalAdmin: false,
    isReviewer: true,
    role: primaryRole,
    userId,
    userEmail,
  }
}

/**
 * Returns list of vacancy IDs the reviewer is allowed to view.
 * If user is global admin, returns null (meaning all).
 */
export async function getPermittedVacancyIds(userId: string, isGlobalAdmin: boolean): Promise<string[] | null> {
  if (isGlobalAdmin) return null // All vacancies

  const now = new Date()
  const assignments = await prisma.recruitmentReviewerAssignment.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: { vacancyId: true },
  })

  // If any assignment has vacancyId == null, user can access all vacancies
  if (assignments.some((a) => a.vacancyId === null)) {
    return null
  }

  return assignments.map((a) => a.vacancyId!).filter(Boolean)
}
