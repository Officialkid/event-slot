import { z } from 'zod'

const questionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  type: z.enum(['text', 'email', 'phone', 'select', 'checkbox', 'textarea', 'number']),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
})

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  eventDate: z.string().datetime({ offset: true }).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  communityLink: z.string().max(500).optional().nullable().or(z.literal('')),
  imageUrl: z.string().url().max(1000).optional().nullable(),
  questions: z.array(questionSchema).min(1, 'At least one question is required').max(30),
  organizerEmail: z.string().email().max(254).or(z.literal('')).optional(),
  organizerName: z.string().min(1, 'Organizer name is required').max(200),
})

export const updateEventSettingsSchema = z.object({
  description: z.string().max(5000).optional().nullable(),
  eventDate: z.string().datetime({ offset: true }).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  communityLink: z.string().max(500).optional().nullable().or(z.literal('')),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
})

export const renameEventSchema = z.object({
  title: z.string().min(1).max(200),
})

export const updateCapacitySchema = z.object({
  newCapacity: z.number().int().positive('Capacity must be a positive integer'),
  token: z.string().optional(),
})
