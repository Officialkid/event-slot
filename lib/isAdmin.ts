function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function getConfiguredAdminEmails(): string[] {
  const email = normalizeEmail(process.env.SUPER_ADMIN_EMAIL)
  return email ? [email] : []
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const candidate = normalizeEmail(email)
  if (!candidate) return false
  return getConfiguredAdminEmails().includes(candidate)
}
