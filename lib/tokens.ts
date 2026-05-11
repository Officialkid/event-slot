import { prisma } from "@/lib/prisma"

// ── Feature costs — single source of truth ──────────────
export const TOKEN_COSTS = {
  DOCUMENT_GENERATION: 20,   // KSh 100
  VOICE_TRANSCRIPTION: 10,   // KSh 50 (after free quota)
} as const

export type TokenFeature = keyof typeof TOKEN_COSTS

// ── Voice free quota ─────────────────────────────────────
export const VOICE_FREE_MONTHLY = 5

// ── Privileged account check ─────────────────────────────
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return (
    email === process.env.PRIVILEGED_ACCOUNT_1 ||
    email === process.env.PRIVILEGED_ACCOUNT_2
  )
}

// ── Get token balance ────────────────────────────────────
export async function getTokenBalance(userId: string): Promise<number> {
  const balance = await prisma.tokenBalance.findUnique({
    where: { userId },
    select: { balance: true },
  })
  return balance?.balance ?? 0
}

// ── Atomic token deduction ───────────────────────────────
export async function deductTokens(
  userId: string,
  feature: TokenFeature,
  description: string,
  referenceId?: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const cost = TOKEN_COSTS[feature]

  try {
    const newBalance = await prisma.$transaction(async (tx) => {
      const current = await tx.tokenBalance.findUnique({ where: { userId } })
      const balance = current?.balance ?? 0

      if (balance < cost) throw new Error("INSUFFICIENT_TOKENS")

      const updated = balance - cost

      await tx.tokenBalance.upsert({
        where: { userId },
        create: { userId, balance: updated },
        update: { balance: updated },
      })

      await tx.tokenTransaction.create({
        data: {
          userId,
          type: "DEBIT",
          amount: -cost,
          balanceBefore: balance,
          balanceAfter: updated,
          description,
          referenceId: referenceId ?? null,
        },
      })

      return updated
    })

    return { success: true, newBalance }

  } catch (error: unknown) {
    if (error instanceof Error && error.message === "INSUFFICIENT_TOKENS") {
      return {
        success: false,
        newBalance: await getTokenBalance(userId),
        error: "INSUFFICIENT_TOKENS",
      }
    }
    throw error
  }
}

// ── Credit tokens ────────────────────────────────────────
export async function creditTokens(
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
  referenceId?: string
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.tokenBalance.findUnique({ where: { userId } })
    const balance = current?.balance ?? 0
    const newBalance = balance + amount

    await tx.tokenBalance.upsert({
      where: { userId },
      create: { userId, balance: newBalance },
      update: { balance: newBalance },
    })

    await tx.tokenTransaction.create({
      data: {
        userId,
        type,
        amount,
        balanceBefore: balance,
        balanceAfter: newBalance,
        description,
        referenceId: referenceId ?? null,
      },
    })

    return newBalance
  })
}

type TransactionType = "PURCHASE" | "DEBIT" | "REFUND" | "ADMIN_GRANT" | "BONUS" | "MONTHLY_VOICE"

// ── Feature gate with super admin bypass ─────────────────
export async function useFeature(
  userId: string,
  userEmail: string,
  feature: TokenFeature,
  description: string,
  referenceId?: string
): Promise<{ allowed: boolean; newBalance?: number; error?: string }> {
  // Super admin always free
  if (isSuperAdmin(userEmail)) return { allowed: true }

  const result = await deductTokens(userId, feature, description, referenceId)
  return result.success
    ? { allowed: true, newBalance: result.newBalance }
    : { allowed: false, newBalance: result.newBalance, error: result.error }
}
