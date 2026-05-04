export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false

  const adminEmails = [
    process.env.SUPER_ADMIN_EMAIL,
    process.env.SUPER_ADMIN_EMAIL_2,
  ].filter((value): value is string => Boolean(value))

  return adminEmails.includes(email)
}
