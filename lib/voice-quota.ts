import { prisma } from "@/lib/prisma"
import { isSuperAdmin, VOICE_FREE_MONTHLY, deductTokens, getTokenBalance } from "@/lib/tokens"

// ── Calculate next reset date (1st of next month, 00:00 EAT) ──
function nextResetDate(): Date {
  const now = new Date()
  // EAT = UTC+3
  const eatNow = new Date(now.getTime() + 3 * 60 * 60 * 1000)

  // First day of next month
  const reset = new Date(Date.UTC(
    eatNow.getFullYear(),
    eatNow.getMonth() + 1,
    1,
    0, 0, 0, 0  // midnight
  ))

  // Convert back to UTC (subtract 3 hours)
  return new Date(reset.getTime() - 3 * 60 * 60 * 1000)
}

// ── Get or initialise voice quota for user ───────────────
async function getOrCreateVoiceQuota(userId: string) {
  const existing = await prisma.voiceQuota.findUnique({ where: { userId } })

  if (!existing) {
    return prisma.voiceQuota.create({
      data: {
        userId,
        usedThisMonth: 0,
        resetAt: nextResetDate(),
      },
    })
  }

  // Check if reset date has passed — if so, reset the count
  if (new Date() >= existing.resetAt) {
    return prisma.voiceQuota.update({
      where: { userId },
      data: {
        usedThisMonth: 0,
        resetAt: nextResetDate(),
      },
    })
  }

  return existing
}

// ── Check voice access before transcribing ───────────────
export async function checkVoiceAccess(
  userId: string,
  userEmail: string
): Promise<{
  allowed: boolean
  isFreeQuota: boolean
  freeRemaining: number
  tokenBalance: number
  resetAt: Date | null
  error?: string
  insufficientTokens?: boolean
}> {
  // Super admin always allowed, always free
  if (isSuperAdmin(userEmail)) {
    return { allowed: true, isFreeQuota: true, freeRemaining: 999, tokenBalance: 0, resetAt: null }
  }

  const quota = await getOrCreateVoiceQuota(userId)
  const freeRemaining = Math.max(0, VOICE_FREE_MONTHLY - quota.usedThisMonth)
  const tokenBalance = await getTokenBalance(userId)

  if (freeRemaining > 0) {
    // Within free quota
    return {
      allowed: true,
      isFreeQuota: true,
      freeRemaining: freeRemaining - 1, // after this use
      tokenBalance,
      resetAt: quota.resetAt,
    }
  }

  // Free quota exhausted — check tokens
  if (tokenBalance < 10) {
    return {
      allowed: false,
      isFreeQuota: false,
      freeRemaining: 0,
      tokenBalance,
      resetAt: quota.resetAt,
      error: "INSUFFICIENT_TOKENS",
      insufficientTokens: true,
    }
  }

  return {
    allowed: true,
    isFreeQuota: false,
    freeRemaining: 0,
    tokenBalance,
    resetAt: quota.resetAt,
  }
}

// ── Record voice use (call after successful transcription) ─
export async function recordVoiceUse(
  userId: string,
  userEmail: string,
  isFreeQuota: boolean
): Promise<void> {
  if (isSuperAdmin(userEmail)) return

  // Increment monthly usage
  await prisma.voiceQuota.update({
    where: { userId },
    data: { usedThisMonth: { increment: 1 } },
  })

  // Deduct tokens if not free quota
  if (!isFreeQuota) {
    await deductTokens(
      userId,
      "VOICE_TRANSCRIPTION",
      "Voice transcription (paid — monthly quota exceeded)"
    )
  }
}
