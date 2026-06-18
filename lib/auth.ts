import { Session } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import type { Provider } from 'next-auth/providers/index'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getConfiguredAdminEmails, isAdminEmail } from '@/lib/isAdmin'
import { checkAndAwardPioneerBadge } from '@/lib/referral'
import { APP_URL } from '@/lib/config'
import { issueOtpForEmail, normalizeEmailForOtp, verifyOtpForEmail } from '@/lib/emailOtp'
import { normalizePlanKey } from '@/lib/effectivePlanPolicy'

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const configuredAdminEmails = new Set(getConfiguredAdminEmails())

function normalizeTier(plan: string | null | undefined): 'FREE' | 'STANDARD' | 'PRO' | 'BUSINESS' {
  const value = (plan ?? 'free').toLowerCase()
  if (value === 'standard') return 'STANDARD'
  if (value === 'pro') return 'PRO'
  if (value === 'business') return 'BUSINESS'
  return 'FREE'
}

const providers: Provider[] = []

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: 'select_account',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    })
  )
} else {
  console.warn('[NextAuth] Google OAuth is disabled: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not fully configured.')
}

providers.push(
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
      otp: { label: 'Verification code', type: 'text' },
      rememberMe: { label: 'Remember me', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null

      const normalizedEmail = normalizeEmailForOtp(credentials.email)
      const user = await prisma.user.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
      })

      if (!user || !user.password || user.suspended) return null

      const valid = await bcrypt.compare(credentials.password, user.password)
      if (!valid) return null

      const requiresOtp = Boolean(user.twoFactorEnabled || user.otpRequired)
      const submittedOtp = typeof credentials.otp === 'string' ? credentials.otp.trim() : ''

      if (requiresOtp && !submittedOtp) {
        try {
          await issueOtpForEmail(normalizedEmail)
        } catch (error) {
          if (error instanceof Error && error.name === 'OTP_RATE_LIMIT') {
            throw new Error('OTP_RATE_LIMIT')
          }
          throw error
        }

        throw new Error('OTP_REQUIRED')
      }

      if (requiresOtp && submittedOtp) {
        const record = await verifyOtpForEmail(normalizedEmail, submittedOtp)
        if (!record) {
          throw new Error('INVALID_OTP')
        }

        if (user.otpRequired || !user.emailVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              otpRequired: false,
              emailVerified: user.emailVerified ?? new Date(),
            },
          })
        }
      }

      return user
    },
  })
)

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: 'jwt' as const,
    maxAge: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24,
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 365,
  },
  pages: {
    signIn: '/signin',
    signOut: '/signin',
    error: '/signin',
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: { id: string; email?: string | null } }) {
      if (user) {
        token.id = user.id
        token.email = user.email ?? token.email ?? null
        token.role = isAdminEmail(user.email) ? 'SUPER_ADMIN' : 'ATTENDEE'
        token.isAdmin = token.role === 'SUPER_ADMIN'

        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { plan: true },
          })
          token.tier = normalizeTier(dbUser?.plan)
          token.plan = normalizePlanKey(dbUser?.plan)
        } catch {
          token.tier = token.tier ?? 'FREE'
          token.plan = token.plan ?? 'free'
        }

        return token
      }

      if (!token.role && isAdminEmail(token.email)) {
        token.role = 'SUPER_ADMIN'
        token.isAdmin = true
      }

      if ((!token.tier || !token.plan) && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { plan: true },
          })
          token.tier = normalizeTier(dbUser?.plan)
          token.plan = normalizePlanKey(dbUser?.plan)
        } catch {
          token.tier = 'FREE'
          token.plan = 'free'
        }
      }

      return token
    },
    async signIn({ user }: { user: { email?: string | null } }) {
      if (!user.email) return true
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { suspended: true },
        })
        if (dbUser?.suspended) return false
      } catch {
        // Never block sign-in due to a DB error
      }
      return true
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        session.user.email = session.user.email ?? token.email ?? null
        session.user.role = token.role ?? (isAdminEmail(session.user.email) ? 'SUPER_ADMIN' : 'ATTENDEE')
        session.user.isAdmin = session.user.role === 'SUPER_ADMIN'
        session.user.tier = token.tier ?? 'FREE'
        session.user.plan = token.plan ?? 'free'

        try {
          const user = await prisma.user.findUnique({
            where: { id: token.sub },
            select: {
              id: true,
              isAdmin: true,
              username: true,
              onboardingCompleted: true,
              onboardingSkipped: true,
              suspended: true,
              plan: true,
            },
          })

          if (user) {
            session.user.isAdmin = session.user.isAdmin || user.isAdmin || configuredAdminEmails.has((session.user.email ?? '').trim().toLowerCase())
            session.user.username = user.username ?? null
            session.user.onboardingCompleted = user.onboardingCompleted ?? false
            session.user.onboardingSkipped = user.onboardingSkipped ?? false
            session.user.suspended = user.suspended ?? false
            session.user.tier = normalizeTier(user.plan)
            session.user.plan = normalizePlanKey(user.plan)
          }
        } catch (error) {
          console.error('[NextAuth session callback error]', error)
        }
      }
      return session
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      const safeBaseUrl =
        baseUrl && !baseUrl.includes('0.0.0.0') && !baseUrl.includes('localhost')
          ? baseUrl
          : APP_URL

      if (url.startsWith('/')) return `${safeBaseUrl}${url}`
      if (url.startsWith(safeBaseUrl)) return url
      return `${safeBaseUrl}/dashboard`
    },
  },
  events: {
    async createUser({ user }: { user: { id?: string } }) {
      if (!user.id) return
      try {
        await prisma.userOnboarding.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        })
      } catch {
        // non-critical
      }
      try {
        await checkAndAwardPioneerBadge(user.id)
      } catch {
        // non-critical
      }
    },
  },
  logger: {
    error(code: string, metadata: unknown) {
      console.error('[NextAuth error]', code, metadata)
    },
    warn(code: string) {
      console.warn('[NextAuth warn]', code)
    },
  },
}
