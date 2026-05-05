import { z } from 'zod'

const answerSchema = z.object({
  questionId: z.string().min(1),
  value: z.string().max(2000),
})

export const publicRegisterSchema = z.object({
  eventSlug: z.string().min(1).max(200),
  attendees: z
    .array(
      z.object({
        answers: z.array(answerSchema).min(1).max(50),
        baseEmail: z.string().email().optional(),
      })
    )
    .min(1)
    .max(20),
  consentTransactional: z.boolean().optional(),
  consentMarketing: z.boolean().optional(),
  forceDuplicate: z.boolean().optional(),
})

export const manualRegisterSchema = z.object({
  answers: z.array(answerSchema).min(1).max(50),
  status: z.enum(['confirmed', 'waitlist']).optional(),
  token: z.string().optional(),
  forceDuplicate: z.boolean().optional(),
})
