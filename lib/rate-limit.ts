import { prisma } from "@/lib/prisma"
import { createHash } from "crypto"

export async function rateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowMinutes: number
): Promise<{ allowed: boolean; remaining: number }> {
  const key         = createHash("sha256").update(`${identifier}:${action}`).digest("hex")
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)

  const count = await prisma.rateLimitLog.count({
    where: { key, createdAt: { gte: windowStart } },
  })

  if (count >= limit) return { allowed: false, remaining: 0 }

  await prisma.rateLimitLog.create({ data: { key, action } })
  return { allowed: true, remaining: limit - count - 1 }
}
