import { prisma } from '@/lib/prisma'
import { sendEmailOtp } from '@/lib/email'

export const OTP_EXPIRY_MINUTES = 10
const OTP_WINDOW_MINUTES = 10
const OTP_MAX_PER_WINDOW = 3

export function normalizeEmailForOtp(email: string) {
  return email.trim().toLowerCase()
}

export function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function issueOtpForEmail(email: string) {
  const normalizedEmail = normalizeEmailForOtp(email)

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
  const normalizedOtp = otp.trim()

  const record = await prisma.emailOTP.findFirst({
    where: {
      email: normalizedEmail,
      otp: normalizedOtp,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) {
    return null
  }

  await prisma.emailOTP.update({
    where: { id: record.id },
    data: { used: true },
  })

  return record
}
