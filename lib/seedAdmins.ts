import { prisma } from './prisma'

function getPrivilegedAccounts() {
  return [
    {
      email: process.env.SUPER_ADMIN_EMAIL,
      name: 'Daniel Mwalili',
      isAdmin: true,
      plan: 'business',
    },
    {
      email: process.env.SUPER_ADMIN_EMAIL_2,
      name: 'EventSlot Admin',
      isAdmin: true,
      plan: 'business',
    },
  ].filter((account): account is { email: string; name: string; isAdmin: boolean; plan: 'business' } => Boolean(account.email))
}

export async function seedPrivilegedAccounts() {
  for (const account of getPrivilegedAccounts()) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: { isAdmin: account.isAdmin, plan: account.plan },
      create: {
        email: account.email,
        name: account.name,
        isAdmin: account.isAdmin,
        plan: account.plan,
      },
    })
  }
}
