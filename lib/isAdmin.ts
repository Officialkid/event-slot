function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function splitEmailList(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/[;,\s]+/)
    .map(normalizeEmail)
    .filter(Boolean)
}

export function getConfiguredAdminEmails(): string[] {
  const emails = new Set<string>()

  for (const email of [
    process.env.SUPER_ADMIN_EMAIL,
    process.env.SUPER_ADMIN_EMAIL_2,
    process.env.PRIVILEGED_ACCOUNT_1,
    process.env.PRIVILEGED_ACCOUNT_2,
  ]) {
    const normalized = normalizeEmail(email)
    if (normalized) emails.add(normalized)
  }

  for (const email of splitEmailList(process.env.SUPER_ADMIN_EMAILS)) {
    emails.add(email)
  }

  return [...emails]
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const candidate = normalizeEmail(email)
  if (!candidate) return false
  return getConfiguredAdminEmails().includes(candidate)
}
