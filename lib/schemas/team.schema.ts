import { z } from 'zod'
import { detectEmailTypo } from '@/lib/emailTypo'

const emailField = z
  .string()
  .email('A valid email address is required')
  .max(254)
  .transform((v) => v.toLowerCase().trim())
  .superRefine((email, ctx) => {
    const typo = detectEmailTypo(email)
    if (typo.hasTypo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: typo.reason || 'Invalid email address domain',
      })
    }
  })

export const teamInviteSchema = z.object({
  emails: z
    .array(emailField)
    .min(1, 'At least one email is required')
    .max(2, 'You can invite up to 2 people at a time'),
  eventId: z.string().cuid().optional(),
})

export const updateMemberEventsSchema = z.object({
  eventIds: z.array(z.string().cuid()).max(500),
})
