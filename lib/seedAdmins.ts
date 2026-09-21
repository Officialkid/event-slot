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

let hasSeeded = false

export async function seedPrivilegedAccounts() {
  if (hasSeeded) return

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
    } catch {
      // Gracefully ignore transient DB wake-up latency — do not crash layout
      return
    }
  }

  hasSeeded = true
}
