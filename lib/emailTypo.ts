const TYPO_DOMAINS: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'iclud.com': 'icloud.com',
  'icluod.com': 'icloud.com',
}

export function detectEmailTypo(email: string): { hasTypo: boolean; suggestion?: string; reason?: string } {
  const clean = email.trim().toLowerCase()
  const parts = clean.split('@')
  if (parts.length !== 2) {
    return { hasTypo: true, reason: 'Invalid email format' }
  }
  const [local, domain] = parts
  if (!local || !domain) {
    return { hasTypo: true, reason: 'Invalid email format' }
  }
  if (TYPO_DOMAINS[domain]) {
    const suggested = `${local}@${TYPO_DOMAINS[domain]}`
    return {
      hasTypo: true,
      suggestion: suggested,
      reason: `Did you mean ${suggested}? The domain "${domain}" looks like a typo.`,
    }
  }
  return { hasTypo: false }
}
