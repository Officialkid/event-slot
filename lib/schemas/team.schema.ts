import { z } from 'zod'

const emailField = z
  .string()
  .email('A valid email address is required')
  .max(254)
  .transform((v) => v.toLowerCase().trim())

export const teamInviteSchema = z.object({
  emails: z
    .array(emailField)
    .min(1, 'At least one email is required')
    .max(2, 'You can invite up to 2 people at a time'),
})

export const updateMemberEventsSchema = z.object({
  eventIds: z.array(z.string().cuid()).max(500),
})
