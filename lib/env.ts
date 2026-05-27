function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val && typeof window === 'undefined') {
    console.error(`[env] MISSING REQUIRED ENV VAR: ${key}`)
  }
  return val ?? ''
}

function optionalEnv(key: string): string {
  return process.env[key]?.trim() ?? ''
}

export const env = {
  APP_URL:
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://www.eventsslot.com',

  DATABASE_URL: requireEnv('DATABASE_URL'),
  NEXTAUTH_SECRET: requireEnv('NEXTAUTH_SECRET'),

  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? '',
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? process.env.EMAIL_API_KEY ?? '',
  RESEND_FROM: optionalEnv('RESEND_FROM'),

  GOOGLE_CLIENT_ID: optionalEnv('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: optionalEnv('GOOGLE_CLIENT_SECRET'),
  PAYSTACK_SECRET_KEY: optionalEnv('PAYSTACK_SECRET_KEY'),
  PAYMENTS_ENABLED: optionalEnv('PAYMENTS_ENABLED'),
  OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY'),
  OPENROUTER_API_KEY: optionalEnv('OPENROUTER_API_KEY'),
  GROQ_API_KEY: optionalEnv('GROQ_API_KEY'),
  ANTHROPIC_API_KEY: optionalEnv('ANTHROPIC_API_KEY'),
  CRON_SECRET: optionalEnv('CRON_SECRET'),
  UPSTASH_REDIS_REST_URL: optionalEnv('UPSTASH_REDIS_REST_URL'),
  UPSTASH_REDIS_REST_TOKEN: optionalEnv('UPSTASH_REDIS_REST_TOKEN'),
  R2_ACCOUNT_ID: optionalEnv('R2_ACCOUNT_ID'),
  R2_ACCESS_KEY_ID: optionalEnv('R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY: optionalEnv('R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME: optionalEnv('R2_BUCKET_NAME'),
  R2_PUBLIC_URL: optionalEnv('R2_PUBLIC_URL'),
  QR_SECRET: optionalEnv('QR_SECRET'),
  IP_HASH_SALT: optionalEnv('IP_HASH_SALT'),
  SUPER_ADMIN_EMAIL: optionalEnv('SUPER_ADMIN_EMAIL'),
  SUPER_ADMIN_EMAIL_2: optionalEnv('SUPER_ADMIN_EMAIL_2'),
  SUPER_ADMIN_EMAILS: optionalEnv('SUPER_ADMIN_EMAILS'),
  PRIVILEGED_ACCOUNT_1: optionalEnv('PRIVILEGED_ACCOUNT_1'),
  PRIVILEGED_ACCOUNT_2: optionalEnv('PRIVILEGED_ACCOUNT_2'),
  REPORT_PRO_ELIGIBILITY_MIN_REGISTRATIONS: optionalEnv('REPORT_PRO_ELIGIBILITY_MIN_REGISTRATIONS'),
  NEXT_PUBLIC_MICROSOFT_STORE_URL: optionalEnv('NEXT_PUBLIC_MICROSOFT_STORE_URL'),
  NEXT_PUBLIC_PAYMENTS_ENABLED: optionalEnv('NEXT_PUBLIC_PAYMENTS_ENABLED'),
}

export function getMissingCriticalEnvVars(): string[] {
  const critical = ['DATABASE_URL', 'NEXTAUTH_SECRET'] as const
  return critical.filter((key) => !process.env[key])
}
