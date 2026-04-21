import { Session } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user || !user.password) return null
        if (user.suspended) return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null
        return user
      },
    }),
  ],
  session: { strategy: 'jwt' as const },
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async signIn({ user }: { user: { email?: string | null } }) {
      if (!user.email) return true
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { suspended: true },
        })
        if (dbUser?.suspended) return false
      } catch {
        // non-critical
      }
      return true
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith(baseUrl)) return url
      return `${baseUrl}/dashboard`
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
    },
  },
}
