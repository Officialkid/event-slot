import { prisma } from "@/lib/prisma"
import { isSuperAdmin } from "@/lib/tokens"

const WINDOW_HOURS = 5
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000
const MAX_CREDITS = 20
const TEXT_CREDIT_COST = 1
const IMAGE_CREDIT_COST = 3

export type QuotaCheckResult =
  | { allowed: true; creditsRemaining: number; resetAt: Date }
  | { allowed: false; creditsRemaining: 0; resetAt: Date; waitMinutes: number }

// Check and consume quota in the current rolling window.
export async function consumeCredits(
  identifier: string,
  userEmail: string | null | undefined,
  imageCount: number = 0
): Promise<QuotaCheckResult> {
  if (userEmail && isSuperAdmin(userEmail)) {
    return {
      allowed: true,
      creditsRemaining: 999,
      resetAt: new Date(Date.now() + WINDOW_MS),
    }
  }

  const cost = TEXT_CREDIT_COST + imageCount * IMAGE_CREDIT_COST
  const now = new Date()

  const quota = await prisma.chatQuota.findUnique({ where: { identifier } })

  if (!quota) {
    await prisma.chatQuota.create({
      data: { identifier, creditsUsed: cost, windowStart: now },
    })
    return {
      allowed: true,
      creditsRemaining: MAX_CREDITS - cost,
      resetAt: new Date(now.getTime() + WINDOW_MS),
    }
  }

  const windowExpiry = new Date(quota.windowStart.getTime() + WINDOW_MS)
  const windowExpired = now >= windowExpiry

  if (windowExpired) {
    await prisma.chatQuota.update({
      where: { identifier },
      data: { creditsUsed: cost, windowStart: now },
    })
    return {
      allowed: true,
      creditsRemaining: MAX_CREDITS - cost,
      resetAt: new Date(now.getTime() + WINDOW_MS),
    }
  }

  const remaining = MAX_CREDITS - quota.creditsUsed

  if (remaining < cost) {
    const waitMs = windowExpiry.getTime() - now.getTime()
    const waitMinutes = Math.ceil(waitMs / 60000)
    return {
      allowed: false,
      creditsRemaining: 0,
      resetAt: windowExpiry,
      waitMinutes,
    }
  }

  await prisma.chatQuota.update({
    where: { identifier },
    data: { creditsUsed: { increment: cost } },
  })

  return {
    allowed: true,
    creditsRemaining: remaining - cost,
    resetAt: windowExpiry,
  }
}

// Read current quota state without consuming credits.
export async function getQuotaStatus(
  identifier: string,
  userEmail: string | null | undefined
): Promise<{ creditsUsed: number; creditsRemaining: number; resetAt: Date; isExpired: boolean }> {
  if (userEmail && isSuperAdmin(userEmail)) {
    return {
      creditsUsed: 0,
      creditsRemaining: 999,
      resetAt: new Date(),
      isExpired: false,
    }
  }

  const quota = await prisma.chatQuota.findUnique({ where: { identifier } })
  const now = new Date()

  if (!quota) {
    return {
      creditsUsed: 0,
      creditsRemaining: MAX_CREDITS,
      resetAt: new Date(now.getTime() + WINDOW_MS),
      isExpired: false,
    }
  }

  const windowExpiry = new Date(quota.windowStart.getTime() + WINDOW_MS)
  const isExpired = now >= windowExpiry

  return {
    creditsUsed: isExpired ? 0 : quota.creditsUsed,
    creditsRemaining: isExpired ? MAX_CREDITS : MAX_CREDITS - quota.creditsUsed,
    resetAt: isExpired ? new Date(now.getTime() + WINDOW_MS) : windowExpiry,
    isExpired,
  }
}

export {
  MAX_CREDITS,
  TEXT_CREDIT_COST,
  IMAGE_CREDIT_COST,
  WINDOW_HOURS,
  WINDOW_MS,
}