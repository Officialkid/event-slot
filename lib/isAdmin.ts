function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function getConfiguredAdminEmails(): string[] {
  const emails: string[] = []
  const email1 = normalizeEmail(process.env.SUPER_ADMIN_EMAIL)
  const email2 = normalizeEmail(process.env.SUPER_ADMIN_EMAIL_2)
  if (email1) emails.push(email1)
  if (email2) emails.push(email2)
  return emails
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const candidate = normalizeEmail(email)
  if (!candidate) return false
  return getConfiguredAdminEmails().includes(candidate)
}
