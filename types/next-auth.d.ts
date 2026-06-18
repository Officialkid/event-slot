import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: 'SUPER_ADMIN' | 'ATTENDEE'
      tier?: 'FREE' | 'STANDARD' | 'PRO' | 'BUSINESS'
      plan?: 'free' | 'standard' | 'pro' | 'business'
      isAdmin: boolean
      username: string | null
      onboardingCompleted: boolean
      onboardingSkipped: boolean
      suspended: boolean
      // Admin Mode fields
      adminModeActive: boolean
      adminModeEventId: string | null
      adminModeEventSlug: string | null
      adminModeOrganiserId: string | null
      adminModeEventTitle: string | null
    }
  }

  interface User {
    id: string
    isAdmin?: boolean
    username?: string | null
    suspended?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    email?: string | null
    role?: 'SUPER_ADMIN' | 'ATTENDEE'
    tier?: 'FREE' | 'STANDARD' | 'PRO' | 'BUSINESS'
    plan?: 'free' | 'standard' | 'pro' | 'business'
    isAdmin?: boolean
    username?: string | null
    // Admin Mode fields
    adminModeActive?: boolean
    adminModeEventId?: string | null
    adminModeEventSlug?: string | null
    adminModeOrganiserId?: string | null
    adminModeEventTitle?: string | null
  }
}
