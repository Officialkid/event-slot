export interface EventDraft {
  id: string
  title: string
  category?: string
  description?: string
  visibility?: string
  accessType?: "REGISTRATION" | "WALK_IN"
  eventType?: "PHYSICAL" | "VIRTUAL"
  virtualLink?: string
  accessWindowPreset?: string
  joinOpensAt?: string
  eventDate?: string
  eventEndAt?: string
  hasSpecificTime?: boolean
  isMultiDay?: boolean
  multiDaySchedule?: any[]
  isRecurring?: boolean
  recurrenceFrequency?: string
  recurrenceDayOfWeek?: number
  registrationOpensDays?: number
  location?: string
  mapDirectionsUrl?: string
  imageUrl?: string
  capacity?: string
  showRemainingSpots?: boolean
  deadline?: string
  entryFeeLabel?: string
  groupRegistrationEnabled?: boolean
  questions?: any[]
  attendeeConsentEnabled?: boolean
  attendeeConsentText?: string
  organizerName?: string
  organizerEmail?: string
  whatsappNumber?: string
  contactMode?: "WHATSAPP" | "CALL"
  communityLink?: string
  currentStep: 1 | 2 | 3 | 4
  updatedAt: number
}

const STORAGE_KEY = "eventslot_event_drafts_v1"
const LEGACY_STORAGE_KEY = "eventslot_create_event_draft"

export function getEventDrafts(): EventDraft[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    let drafts: EventDraft[] = []

    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        drafts = parsed.filter(d => d && typeof d === "object" && typeof d.id === "string")
      }
    }

    // Auto-migrate legacy single draft if not already in drafts
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw)
        if (legacy && (legacy.title || legacy.description || legacy.eventDate)) {
          const alreadyExists = drafts.some(d => d.title === legacy.title && Math.abs((d.updatedAt || 0) - (legacy.updatedAt || 0)) < 60000)
          if (!alreadyExists) {
            const migrated: EventDraft = {
              id: "draft_legacy_" + (legacy.updatedAt || Date.now()),
              title: legacy.title || "Untitled Draft",
              category: legacy.category,
              description: legacy.description,
              visibility: legacy.visibility,
              accessType: legacy.accessType,
              eventType: legacy.eventType,
              virtualLink: legacy.virtualLink,
              accessWindowPreset: legacy.accessWindowPreset,
              joinOpensAt: legacy.joinOpensAt,
              eventDate: legacy.eventDate,
              eventEndAt: legacy.eventEndAt,
              hasSpecificTime: legacy.hasSpecificTime,
              isRecurring: legacy.isRecurring,
              recurrenceFrequency: legacy.recurrenceFrequency,
              recurrenceDayOfWeek: legacy.recurrenceDayOfWeek,
              registrationOpensDays: legacy.registrationOpensDays,
              location: legacy.location,
              mapDirectionsUrl: legacy.mapDirectionsUrl,
              imageUrl: legacy.imageUrl,
              capacity: legacy.capacity,
              showRemainingSpots: legacy.showRemainingSpots,
              deadline: legacy.deadline,
              entryFeeLabel: legacy.entryFeeLabel,
              groupRegistrationEnabled: legacy.groupRegistrationEnabled,
              questions: Array.isArray(legacy.questions) ? legacy.questions : [],
              attendeeConsentEnabled: legacy.attendeeConsentEnabled,
              attendeeConsentText: legacy.attendeeConsentText,
              organizerName: legacy.organizerName,
              whatsappNumber: legacy.whatsappNumber,
              contactMode: legacy.contactMode,
              communityLink: legacy.communityLink,
              currentStep: [1, 2, 3, 4].includes(legacy.currentStep) ? legacy.currentStep : 1,
              updatedAt: legacy.updatedAt || Date.now(),
            }
            drafts.unshift(migrated)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
          }
        }
      } catch {
        // ignore legacy parse error
      }
    }

    // Sort newest first
    drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    return drafts
  } catch {
    return []
  }
}

export function getEventDraft(id: string): EventDraft | null {
  if (!id || typeof window === "undefined") return null
  const drafts = getEventDrafts()
  return drafts.find(d => d.id === id) || null
}

export function saveEventDraft(draftData: Partial<EventDraft> & { id?: string }): string {
  if (typeof window === "undefined") return ""
  try {
    const drafts = getEventDrafts()
    const now = Date.now()
    const draftId = draftData.id || `draft_${now}_${Math.random().toString(36).substring(2, 7)}`

    const cleanDraft: EventDraft = {
      id: draftId,
      title: (draftData.title || "").trim() || "Untitled Draft",
      category: draftData.category,
      description: draftData.description,
      visibility: draftData.visibility,
      accessType: draftData.accessType,
      eventType: draftData.eventType,
      virtualLink: draftData.virtualLink,
      accessWindowPreset: draftData.accessWindowPreset,
      joinOpensAt: draftData.joinOpensAt,
      eventDate: draftData.eventDate,
      eventEndAt: draftData.eventEndAt,
      hasSpecificTime: draftData.hasSpecificTime,
      isRecurring: draftData.isRecurring,
      recurrenceFrequency: draftData.recurrenceFrequency,
      recurrenceDayOfWeek: draftData.recurrenceDayOfWeek,
      registrationOpensDays: draftData.registrationOpensDays,
      location: draftData.location,
      mapDirectionsUrl: draftData.mapDirectionsUrl,
      imageUrl: draftData.imageUrl,
      capacity: draftData.capacity,
      showRemainingSpots: draftData.showRemainingSpots,
      deadline: draftData.deadline,
      entryFeeLabel: draftData.entryFeeLabel,
      groupRegistrationEnabled: draftData.groupRegistrationEnabled,
      questions: Array.isArray(draftData.questions) ? draftData.questions : [],
      attendeeConsentEnabled: draftData.attendeeConsentEnabled,
      attendeeConsentText: draftData.attendeeConsentText,
      organizerName: draftData.organizerName,
      organizerEmail: draftData.organizerEmail,
      whatsappNumber: draftData.whatsappNumber,
      contactMode: draftData.contactMode,
      communityLink: draftData.communityLink,
      currentStep: ([1, 2, 3, 4].includes(draftData.currentStep as number) ? draftData.currentStep : 1) as 1 | 2 | 3 | 4,
      updatedAt: now,
    }

    const existingIdx = drafts.findIndex(d => d.id === draftId)
    if (existingIdx >= 0) {
      drafts[existingIdx] = cleanDraft
    } else {
      drafts.unshift(cleanDraft)
    }

    // Keep at most 25 drafts
    const trimmed = drafts.slice(0, 25)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))

    // Also mirror to legacy key for single-draft resume fallback
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(cleanDraft))

    return draftId
  } catch {
    return ""
  }
}

export function deleteEventDraft(id: string): void {
  if (!id || typeof window === "undefined") return
  try {
    const drafts = getEventDrafts().filter(d => d.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw)
        if (legacy && legacy.id === id) {
          localStorage.removeItem(LEGACY_STORAGE_KEY)
        }
      } catch {}
    }
  } catch {}
}

export function clearAllEventDrafts(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {}
}

export function formatDraftTimeAgo(timestamp: number): string {
  if (!timestamp) return "Recently"
  const diffMs = Date.now() - timestamp
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return "Just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 14) return `${diffDays}d ago`
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function getDraftStepLabel(step: number): string {
  switch (step) {
    case 1:
      return "Step 1: Identity & Timing"
    case 2:
      return "Step 2: Tickets & Access"
    case 3:
      return "Step 3: Registration Questions"
    case 4:
      return "Step 4: Review & Launch"
    default:
      return `Step ${step}`
  }
}
