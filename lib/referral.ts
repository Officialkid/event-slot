import { prisma } from "@/lib/prisma"
import { creditTokens } from "@/lib/tokens"
import { APP_URL } from "@/lib/config"

const REFERRAL_BASE_URL = APP_URL
const SIGNUP_REWARD = 5
const EVENT_REWARD = 5
export const ATTRIBUTION_DAYS = 7
const PIONEER_LIMIT = 150

export async function getOrCreateReferralLink(userId: string): Promise<string> {
  const existing = await prisma.referralLink.findUnique({
    where: { userId },
    select: { code: true },
  })

  if (existing) {
    return `${REFERRAL_BASE_URL}/join?ref=${existing.code}`
  }

  const link = await prisma.referralLink.create({
    data: { userId, code: userId },
    select: { code: true },
  })

  return `${REFERRAL_BASE_URL}/join?ref=${link.code}`
}

export async function processSignupReferral(newUserId: string, referralCode: string): Promise<void> {
  if (!referralCode) return

  const referralLink = await prisma.referralLink.findUnique({
    where: { code: referralCode },
    select: { id: true, userId: true },
  })

  if (!referralLink) return
  if (referralLink.userId === newUserId) return

  const alreadyReferred = await prisma.referral.findUnique({
    where: { referredUserId: newUserId },
    select: { id: true },
  })

  if (alreadyReferred) return

  await prisma.referral.create({
    data: {
      referrerId: referralLink.userId,
      referredUserId: newUserId,
      linkId: referralLink.id,
      status: "SIGNED_UP",
      signupTokens: SIGNUP_REWARD,
      totalEarned: SIGNUP_REWARD,
    },
  })

  await creditTokens(
    referralLink.userId,
    SIGNUP_REWARD,
    "BONUS",
    "Referral reward - new user signed up via your link",
    newUserId
  )

  await prisma.referralLink.update({
    where: { id: referralLink.id },
    data: { clicks: { increment: 1 } },
  })

  await updateLeaderboardScore(referralLink.userId, 5)
  await checkAndAwardBadges(referralLink.userId)
}

export async function processFirstEventReferral(userId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({
    where: { referredUserId: userId },
    select: { id: true, referrerId: true, status: true, signupTokens: true, totalEarned: true },
  })

  if (!referral || referral.status !== "SIGNED_UP") return

  const updated = await prisma.referral.updateMany({
    where: { id: referral.id, status: "SIGNED_UP" },
    data: {
      status: "EVENT_CREATED",
      eventTokens: EVENT_REWARD,
      totalEarned: referral.totalEarned + EVENT_REWARD,
      eventCreatedAt: new Date(),
    },
  })

  if (updated.count === 0) return

  await creditTokens(
    referral.referrerId,
    EVENT_REWARD,
    "BONUS",
    "Referral reward - your referral created their first event",
    userId
  )

  await updateLeaderboardScore(referral.referrerId, 10)
  await checkAndAwardBadges(referral.referrerId)

  await prisma.notification.create({
    data: {
      userId: referral.referrerId,
      type: "PLATFORM",
      title: "Referral reward earned!",
      message: `Someone you referred just created their first event on EventSlot. You've earned ${EVENT_REWARD} tokens!`,
    },
  })
}

export async function checkAndAwardPioneerBadge(userId: string): Promise<boolean> {
  const result = await prisma.$transaction(async (tx) => {
    const already = await tx.pioneerBadge.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (already) return true

    const currentCount = await tx.pioneerBadge.count()
    if (currentCount >= PIONEER_LIMIT) return false

    await tx.pioneerBadge.create({
      data: { userId, hasSeenCongratulations: false },
    })

    await tx.userBadge.upsert({
      where: { userId_badge: { userId, badge: "PIONEER" } },
      create: { userId, badge: "PIONEER" },
      update: {},
    })

    await tx.notification.create({
      data: {
        userId,
        type: "PLATFORM",
        title: "You're an EventSlot Pioneer!",
        message:
          "You are one of EventSlot's earliest supporters. Your Pioneer badge has been awarded - wear it with pride.",
        link: "/dashboard/community",
      },
    })

    return true
  })

  return result
}

async function checkAndAwardBadges(userId: string): Promise<void> {
  const successfulReferrals = await prisma.referral.count({
    where: { referrerId: userId, status: "EVENT_CREATED" },
  })

  if (successfulReferrals >= 5) {
    await prisma.userBadge.upsert({
      where: { userId_badge: { userId, badge: "GROWTH_BUILDER" } },
      create: { userId, badge: "GROWTH_BUILDER" },
      update: {},
    })
  }
}

export async function updateLeaderboardScore(userId: string, points: number): Promise<void> {
  const weekStart = getWeekStart()

  await prisma.$transaction(async (tx) => {
    const existing = await tx.leaderboardEntry.findUnique({
      where: { userId },
      select: { id: true, weekStart: true },
    })

    if (!existing) {
      await tx.leaderboardEntry.create({
        data: {
          userId,
          weeklyScore: points,
          monthlyScore: points,
          allTimeScore: points,
          weekStart,
        },
      })
      return
    }

    const sameWeek =
      existing.weekStart.getUTCFullYear() === weekStart.getUTCFullYear() &&
      existing.weekStart.getUTCMonth() === weekStart.getUTCMonth() &&
      existing.weekStart.getUTCDate() === weekStart.getUTCDate()

    await tx.leaderboardEntry.update({
      where: { id: existing.id },
      data: {
        weeklyScore: sameWeek ? { increment: points } : points,
        monthlyScore: { increment: points },
        allTimeScore: { increment: points },
        weekStart: sameWeek ? undefined : weekStart,
      },
    })
  })
}

export async function scoreEventCreation(userId: string): Promise<void> {
  await updateLeaderboardScore(userId, 3)
}

function getWeekStart(): Date {
  const now = new Date()
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = utc.getUTCDay()
  const offset = day === 0 ? 6 : day - 1
  utc.setUTCDate(utc.getUTCDate() - offset)
  utc.setUTCHours(0, 0, 0, 0)
  return utc
}
