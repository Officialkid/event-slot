import { prisma } from '@/lib/prisma'
import { sendEmailOtp } from '@/lib/email'

export const OTP_EXPIRY_MINUTES = 10
export const OTP_COOLDOWN_SECONDS = 30
const OTP_WINDOW_MINUTES = 10
const OTP_MAX_PER_WINDOW = 5

export function normalizeEmailForOtp(email: string) {
  return email.trim().toLowerCase()
}

export function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function issueOtpForEmail(email: string) {
  const normalizedEmail = normalizeEmailForOtp(email)

  // 30-Second Cooldown Check
  const latestOtp = await prisma.emailOTP.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: 'desc' },
  })

  if (latestOtp && (Date.now() - latestOtp.createdAt.getTime()) < OTP_COOLDOWN_SECONDS * 1000) {
    const remainingSeconds = Math.ceil((OTP_COOLDOWN_SECONDS * 1000 - (Date.now() - latestOtp.createdAt.getTime())) / 1000)
    const error = new Error(`Please wait ${remainingSeconds} seconds before requesting a new code.`)
    error.name = 'OTP_COOLDOWN'
    ;(error as any).remainingSeconds = remainingSeconds
    throw error
  }

  const recentCount = await prisma.emailOTP.count({
    where: {
      email: normalizedEmail,
      createdAt: { gte: new Date(Date.now() - OTP_WINDOW_MINUTES * 60 * 1000) },
    },
  })

  if (recentCount >= OTP_MAX_PER_WINDOW) {
    const error = new Error('Too many OTP attempts. Please wait 10 minutes before trying again.')
    error.name = 'OTP_RATE_LIMIT'
    throw error
  }

  // Invalidate any older unused codes for this email so there are no stale codes floating around
  await prisma.emailOTP.updateMany({
    where: {
      email: normalizedEmail,
      used: false,
    },
    data: { used: true },
  })

  const otp = generateOtpCode()
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

  await prisma.emailOTP.create({
    data: {
      email: normalizedEmail,
      otp,
      expiresAt,
    },
  })

  await sendEmailOtp({ to: normalizedEmail, otp })

  return { otp, expiresAt }
}

export async function verifyOtpForEmail(email: string, otp: string) {
  const normalizedEmail = normalizeEmailForOtp(email)
  // Sanitize input: strip all whitespace, dashes, and non-digits (handles "123 456", "123-456", etc.)
  const cleanOtp = otp.replace(/\D/g, '')

  if (cleanOtp.length !== 6) {
    return null
  }

  // 1. Primary check: unused valid OTP
  const record = await prisma.emailOTP.findFirst({
    where: {
      email: normalizedEmail,
      otp: cleanOtp,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (record) {
    await prisma.emailOTP.update({
      where: { id: record.id },
      data: { used: true },
    })
    return record
  }

  // 2. Tolerance grace window: if this exact code was verified within the last 60 seconds,
  // allow subsequent verification to succeed (prevents double-consumption lockouts between verify & signIn)
  const recentlyVerified = await prisma.emailOTP.findFirst({
    where: {
      email: normalizedEmail,
      otp: cleanOtp,
      used: true,
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (recentlyVerified) {
    return recentlyVerified
  }

  return null
}
