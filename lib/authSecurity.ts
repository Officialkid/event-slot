import { prisma } from "@/lib/prisma"

const FAILURE_RESET_WINDOW_MS = 30 * 60 * 1000
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000

export const LOGIN_LOCK_THRESHOLD = 5
export const LOGIN_CHALLENGE_THRESHOLD = 3

type LoginSecuritySnapshot = {
  failedAttempts: number
  lockedUntil: Date | null
  shouldSlowDown: boolean
}

function now(): Date {
  return new Date()
}

function isStale(lastFailedAt: Date | null | undefined, at: Date): boolean {
  if (!lastFailedAt) return true
  return at.getTime() - lastFailedAt.getTime() > FAILURE_RESET_WINDOW_MS
}

function computeDelayMs(failedAttempts: number): number {
  if (failedAttempts < LOGIN_CHALLENGE_THRESHOLD) return 0
  if (failedAttempts === 3) return 1500
  if (failedAttempts === 4) return 4000
  return 7000
}

export async function waitForLoginBackoff(failedAttempts: number): Promise<void> {
  const delayMs = computeDelayMs(failedAttempts)
  if (delayMs <= 0) return
  await new Promise((resolve) => setTimeout(resolve, delayMs))
}

export async function getLoginSecuritySnapshot(email: string): Promise<LoginSecuritySnapshot> {
  const normalizedEmail = email.trim().toLowerCase()
  const current = now()
  const state = await prisma.loginSecurityState.findUnique({
    where: { email: normalizedEmail },
  })

  if (!state) {
    return {
      failedAttempts: 0,
      lockedUntil: null,
      shouldSlowDown: false,
    }
  }

  if (isStale(state.lastFailedAt, current) && !state.lockedUntil) {
    await prisma.loginSecurityState.update({
      where: { email: normalizedEmail },
      data: {
        failedAttempts: 0,
        lastFailedAt: null,
      },
    })

    return {
      failedAttempts: 0,
      lockedUntil: null,
      shouldSlowDown: false,
    }
  }

  return {
    failedAttempts: state.failedAttempts,
    lockedUntil: state.lockedUntil,
    shouldSlowDown: state.failedAttempts >= LOGIN_CHALLENGE_THRESHOLD,
  }
}

export async function recordFailedLoginAttempt(email: string): Promise<LoginSecuritySnapshot> {
  const normalizedEmail = email.trim().toLowerCase()
  const current = now()
  const state = await prisma.loginSecurityState.findUnique({
    where: { email: normalizedEmail },
  })

  const nextFailedAttempts = !state || isStale(state.lastFailedAt, current)
    ? 1
    : state.failedAttempts + 1

  const lockedUntil =
    nextFailedAttempts >= LOGIN_LOCK_THRESHOLD
      ? new Date(current.getTime() + LOGIN_LOCK_WINDOW_MS)
      : null

  await prisma.loginSecurityState.upsert({
    where: { email: normalizedEmail },
    update: {
      failedAttempts: nextFailedAttempts,
      lastFailedAt: current,
      lockedUntil,
    },
    create: {
      email: normalizedEmail,
      failedAttempts: nextFailedAttempts,
      lastFailedAt: current,
      lockedUntil,
    },
  })

  return {
    failedAttempts: nextFailedAttempts,
    lockedUntil,
    shouldSlowDown: nextFailedAttempts >= LOGIN_CHALLENGE_THRESHOLD,
  }
}

export async function clearFailedLoginAttempts(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  await prisma.loginSecurityState.upsert({
    where: { email: normalizedEmail },
    update: {
      failedAttempts: 0,
      lastFailedAt: null,
      lockedUntil: null,
    },
    create: {
      email: normalizedEmail,
      failedAttempts: 0,
      lastFailedAt: null,
      lockedUntil: null,
    },
  })
}
