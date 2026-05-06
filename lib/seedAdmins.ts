import { prisma } from './prisma'
import { getConfiguredAdminEmails } from './isAdmin'

function getPrivilegedAccounts() {
  const defaultNames = ['Daniel Mwalili', 'EventSlot Admin']
  return getConfiguredAdminEmails().map((email, index) => ({
    email,
    name: defaultNames[index] ?? 'EventSlot Admin',
    isAdmin: true,
  }))
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
