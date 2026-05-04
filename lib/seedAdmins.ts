import { prisma } from './prisma'

const PRIVILEGED_ACCOUNTS = [
  {
    email: 'danielmwaliliofficial@gmail.com',
    name: 'Daniel Mwalili',
    isAdmin: true,
    plan: 'free',
  },
  {
    email: 'danielmwalili1@gmail.com',
    name: 'Daniel',
    isAdmin: false,
    plan: 'free',
  },
]

export async function seedPrivilegedAccounts() {
  for (const account of PRIVILEGED_ACCOUNTS) {
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
