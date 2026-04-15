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
