import { z } from 'zod'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages'

const supportedLanguageCodes = SUPPORTED_LANGUAGES.map(language => language.code) as [string, ...string[]]

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  username: z.string().min(2).max(40).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores').optional(),
  bio: z.string().max(500).optional().nullable(),
  website: z.string().url().max(500).optional().nullable().or(z.literal('')),
  consentSystemEmails: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
  preferredLanguage: z.enum(supportedLanguageCodes).optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
})
