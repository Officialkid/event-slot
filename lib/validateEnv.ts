export function validateR2Env(): string[] {
  const required = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL',
  ]
  return required.filter((key) => !process.env[key])
}

/**
 * Validates R2 configuration specifically for private candidate recruitment documents.
 * Unlike public image uploads (which need R2_PUBLIC_URL), private candidate documents
 * must NEVER be given a public URL. They only require S3 credentials and bucket name.
 */
export function validateRecruitmentStorageEnv(): string[] {
  const required = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ]
  const missing = required.filter((key) => !process.env[key])
  if (!process.env.RECRUITMENT_R2_BUCKET_NAME && !process.env.R2_BUCKET_NAME) {
    missing.push('R2_BUCKET_NAME or RECRUITMENT_R2_BUCKET_NAME')
  }
  return missing
}
