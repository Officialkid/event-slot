import { z } from 'zod'

export const teamInviteSchema = z.object({
  email: z
    .string({ error: 'A valid email address is required' })
    .email('A valid email address is required')
    .max(254)
    .transform((v) => v.toLowerCase().trim()),
})

export const updateMemberEventsSchema = z.object({
  eventIds: z.array(z.string().cuid()).max(500),
})
