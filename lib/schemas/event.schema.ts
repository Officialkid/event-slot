import { z } from 'zod'
import { normalizeInternationalPhoneNumber } from '@/lib/eventContact'

const questionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  type: z.enum(['text', 'email', 'phone', 'select', 'checkbox', 'textarea', 'number', 'file']),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  optionLimits: z.record(z.string(), z.number().int().positive().nullable()).optional(),
  allowMultiple: z.boolean().optional(),
})

const ticketTierSchema = z.object({
  name: z.string().min(1, 'Tier name is required').max(120),
  presetKey: z.string().max(40).optional().nullable(),
  badgeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Badge colour must be a valid hex value'),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Text colour must be a valid hex value'),
  metallic: z.boolean().optional().default(false),
  prestige: z.number().int().min(0).max(99).optional().default(0),
  priceKes: z.number().int().positive('Tier price must be positive'),
  currency: z.string().max(8).optional().default('KES'),
  capacity: z.number().int().positive('Tier capacity must be positive'),
  description: z.string().max(500).optional().nullable(),
  bundleSize: z.number().int().positive().max(100).optional().nullable(),
})

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  category: z.string().max(40).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),
  accessType: z.enum(['REGISTRATION', 'WALK_IN']).default('REGISTRATION'),
  eventType: z.enum(['PHYSICAL', 'VIRTUAL']).default('PHYSICAL'),
  virtualLink: z.string().max(1000).optional().nullable().or(z.literal('')),  // URL format validated in superRefine (accepts with or without https://)
  capacity: z.number().int().positive().optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  eventDate: z.string().datetime({ offset: true }).optional().nullable(),
  eventEndAt: z.string().datetime({ offset: true }).optional().nullable(),
  joinOpensAt: z.string().datetime({ offset: true }).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  mapDirectionsUrl: z.string().url('Please provide a valid map directions URL').max(1000).optional().nullable().or(z.literal('')),
  entryFeeLabel: z.string().max(200, 'Entry fee note must be 200 characters or less').optional().nullable().or(z.literal('')),
  showRemainingSpots: z.boolean().optional().default(true),
  attendeeConsentEnabled: z.boolean().optional().default(true),
  attendeeConsentText: z.string().max(1000, 'Consent text must be 1000 characters or less').optional().nullable().or(z.literal('')),
  isPaid: z.boolean().optional().default(false),
  groupRegistrationEnabled: z.boolean().optional().default(false),
  allowGroupSelfClaim: z.boolean().optional().default(true),
  ticketPrice: z.number().int().positive().optional().nullable(),
  ticketTiers: z.array(ticketTierSchema).max(10, 'Maximum 10 ticket tiers').optional().default([]),
  communityLink: z.string().max(500).optional().nullable().or(z.literal('')),
  whatsappNumber: z.string().max(40).optional().nullable().or(z.literal('')),
  contactMode: z.enum(['WHATSAPP', 'CALL']).optional().default('WHATSAPP'),
  imageUrl: z.string().url().max(1000).optional().nullable(),
  questions: z.array(questionSchema).max(30).default([]),
  organizerEmail: z.string().email().max(254).or(z.literal('')).optional(),
  organizerName: z.string().min(1, 'Organizer name is required').max(200),
}).superRefine((data, ctx) => {
  if (data.accessType === 'REGISTRATION' && data.questions.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['questions'],
      message: 'At least one question is required',
    })
  }

  if (data.eventType === 'VIRTUAL' && !data.virtualLink?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['virtualLink'],
      message: 'Google Meet link is required for virtual events',
    })
  }

    if (data.eventType === 'VIRTUAL' && data.virtualLink?.trim()) {
    const raw = data.virtualLink.trim()
    // Normalise: accept links pasted without the https:// scheme, or with http://
    let withScheme = raw
    if (/^meet\.google\.com\//i.test(raw)) withScheme = `https://${raw}`
    else if (/^http:\/\/meet\.google\.com\//i.test(raw)) withScheme = raw.replace(/^http:\/\//i, 'https://')
    if (!withScheme.toLowerCase().startsWith('https://meet.google.com/')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['virtualLink'],
        message: 'Please provide a valid Google Meet link (e.g. meet.google.com/abc-defg-hij)',
      })
    }
  }

  if (data.accessType === 'WALK_IN' && data.eventType !== 'PHYSICAL') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['eventType'],
      message: 'Walk-In events are only available for physical events right now',
    })
  }

  if (data.accessType === 'WALK_IN' && !data.eventDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['eventDate'],
      message: 'Walk-In events need a start date',
    })
  }

  if (data.accessType === 'WALK_IN' && data.isPaid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['isPaid'],
      message: 'Walk-In events do not support paid ticketing in this version',
    })
  }

  if (data.accessType === 'WALK_IN' && data.capacity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['capacity'],
      message: 'Walk-In events do not use capacity limits',
    })
  }

  if (data.accessType === 'WALK_IN' && data.visibility === 'PUBLIC') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['visibility'],
      message: 'Walk-In events stay private in this version',
    })
  }

  if (data.isPaid && !data.ticketPrice) {
    if (!data.ticketTiers || data.ticketTiers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ticketTiers'],
        message: 'At least one ticket tier is required for paid events',
      })
    }
  }

  if (data.isPaid && (!data.ticketTiers || data.ticketTiers.length === 0) && data.ticketPrice && data.ticketPrice < 50) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ticketPrice'],
      message: 'Minimum ticket price is KSh 50',
    })
  }

  if (data.isPaid && (!data.ticketTiers || data.ticketTiers.length === 0) && data.ticketPrice && data.ticketPrice > 500000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ticketPrice'],
      message: 'Maximum ticket price is KSh 500,000',
    })
  }

  if (data.isPaid) {
    const tiers = data.ticketTiers ?? []
    if (tiers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ticketTiers'],
        message: 'At least one ticket tier is required for paid events',
      })
    }
    for (const [index, tier] of tiers.entries()) {
      if (tier.priceKes < 50) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ticketTiers', index, 'priceKes'],
          message: 'Minimum tier price is KSh 50',
        })
      }
      if (tier.priceKes > 500000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ticketTiers', index, 'priceKes'],
          message: 'Maximum tier price is KSh 500,000',
        })
      }
    }
  }

  if (data.whatsappNumber?.trim()) {
    const normalized = normalizeInternationalPhoneNumber(data.whatsappNumber)
    if (!normalized.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['whatsappNumber'],
        message: normalized.error,
      })
    }
  }

  if (data.eventDate && data.eventEndAt) {
    const start = new Date(data.eventDate)
    const end = new Date(data.eventEndAt)
    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventEndAt'],
        message: 'Event end time must be after the start time',
      })
    }
  }

  if (data.deadline && data.eventEndAt) {
    const deadline = new Date(data.deadline)
    const end = new Date(data.eventEndAt)
    if (deadline > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deadline'],
        message: 'Registration deadline cannot be after the event end time',
      })
    }
  }

  if (data.visibility === 'PUBLIC' && !data.imageUrl?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['imageUrl'],
      message: 'Public events require a poster image',
    })
  }

  if (data.visibility === 'PUBLIC' && !data.eventDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['eventDate'],
      message: 'Public events require a start date',
    })
  }

  if (data.visibility === 'PUBLIC' && data.eventType === 'PHYSICAL' && !data.location?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['location'],
      message: 'Public physical events require a location',
    })
  }
})

export const updateEventSettingsSchema = z.object({
  description: z.string().max(5000).optional().nullable(),
  organizerName: z.string().min(1, 'Organizer name is required').max(200).optional(),
  eventDate: z.string().datetime({ offset: true }).optional().nullable(),
  eventEndAt: z.string().datetime({ offset: true }).optional().nullable(),
  joinOpensAt: z.string().datetime({ offset: true }).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  mapDirectionsUrl: z.string().url('Please provide a valid map directions URL').max(1000).optional().nullable().or(z.literal('')),
  entryFeeLabel: z.string().max(200, 'Entry fee note must be 200 characters or less').optional().nullable().or(z.literal('')),
  imageUrl: z.string().url().max(1000).optional().nullable().or(z.literal('')),
  showRemainingSpots: z.boolean().optional(),
  attendeeConsentEnabled: z.boolean().optional(),
  attendeeConsentText: z.string().max(1000, 'Consent text must be 1000 characters or less').optional().nullable().or(z.literal('')),
  communityLink: z.string().max(500).optional().nullable().or(z.literal('')),
  whatsappNumber: z.string().max(40).optional().nullable().or(z.literal('')),
  contactMode: z.enum(['WHATSAPP', 'CALL']).optional().default('WHATSAPP'),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.whatsappNumber?.trim()) {
    const normalized = normalizeInternationalPhoneNumber(data.whatsappNumber)
    if (!normalized.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['whatsappNumber'],
        message: normalized.error,
      })
    }
  }

  if (data.eventDate && data.eventEndAt) {
    const start = new Date(data.eventDate)
    const end = new Date(data.eventEndAt)
    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventEndAt'],
        message: 'Event end time must be after the start time',
      })
    }
  }

  if (data.deadline && data.eventEndAt) {
    const deadline = new Date(data.deadline)
    const end = new Date(data.eventEndAt)
    if (deadline > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deadline'],
        message: 'Registration deadline cannot be after the event end time',
      })
    }
  }
})

export const renameEventSchema = z.object({
  title: z.string().min(1).max(200),
})

export const updateCapacitySchema = z.object({
  newCapacity: z.number().int().positive('Capacity must be a positive integer'),
  token: z.string().optional(),
})
