import { prisma } from './prisma'

function getPrivilegedAccounts() {
  return [
    {
      email: process.env.SUPER_ADMIN_EMAIL,
      name: 'Daniel Mwalili',
      isAdmin: true,
    },
    {
      email: process.env.SUPER_ADMIN_EMAIL_2,
      name: 'EventSlot Admin',
      isAdmin: true,
    },
  ].filter((account): account is { email: string; name: string; isAdmin: boolean } => Boolean(account.email))
}

export async function seedPrivilegedAccounts() {
  for (const account of getPrivilegedAccounts()) {
    try {
      await prisma.user.upsert({
        where: { email: account.email },
        update: {
          isAdmin: account.isAdmin,
          suspended: false,
        },
        create: {
          email: account.email,
          name: account.name,
          isAdmin: account.isAdmin,
          suspended: false,
        },
      })
    } catch (error) {
      // Log but NEVER throw — a seed failure must not crash the app
      console.error(`[seed] Failed to seed ${account.email}:`, error)
    }
  }
}
