function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function getConfiguredAdminEmails(): string[] {
  const fromPrimaryVars = [process.env.SUPER_ADMIN_EMAIL, process.env.SUPER_ADMIN_EMAIL_2]
  const fromListVar = (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const normalized = [...fromPrimaryVars, ...fromListVar]
    .map((value) => normalizeEmail(value))
    .filter(Boolean)

  return Array.from(new Set(normalized))
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const candidate = normalizeEmail(email)
  if (!candidate) return false
  return getConfiguredAdminEmails().includes(candidate)
}
