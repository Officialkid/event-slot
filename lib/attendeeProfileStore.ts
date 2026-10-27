/**
 * EventSlot Attendee Profile Store & Semantic Field Classifier
 *
 * Implements privacy-first, client-side persistent device memory for recurring attendee details:
 * - Stores ONLY recurrent contact details (Name, Email, Phone, Location, Organization, Job Title).
 * - Strictly EXCLUDES event-specific ephemeral questions (Expectations, Dietary, Sizing, Sessions).
 * - Stored purely on the attendee's local device (localStorage); zero server tracking or cross-device profiling.
 * - Provides immediate opt-out and one-click data clearing.
 */

export interface AttendeeProfile {
  name?: string
  email?: string
  phone?: string
  location?: string
  organization?: string
  jobTitle?: string
  updatedAt: number
}

export type SemanticCategory =
  | 'name'
  | 'email'
  | 'phone'
  | 'location'
  | 'organization'
  | 'jobTitle'

export const ATTENDEE_PROFILE_STORAGE_KEY = 'eventslot_attendee_profile_v1'
export const ATTENDEE_REMEMBER_OPT_OUT_KEY = 'eventslot_attendee_remember_disabled'

/**
 * Patterns for ephemeral, event-specific questions that must NEVER be persisted or prefilled across different events.
 */
const EPHEMERAL_PATTERNS = [
  /expect/i,
  /hope\s*to/i,
  /learn/i,
  /goal/i,
  /objective/i,
  /outcome/i,
  /diet/i,
  /meal/i,
  /allergy|allergies/i,
  /food/i,
  /vegan|vegetarian|halal|kosher/i,
  /shirt|t-shirt|size|hoodie/i,
  /session|track|workshop|breakout/i,
  /hear\s*about/i,
  /referral\s*source/i,
  /feedback|comment|suggestion/i,
  /reason\s*(for|to)/i,
  /why\s*(are\s*you|do\s*you)/i,
  /experience\s*level/i,
  /topic/i,
  /question\s*(for|to)/i,
]

/**
 * Determines whether a question is event-specific / ephemeral.
 */
export function isEphemeralQuestion(label: string, id?: string): boolean {
  const combined = `${label || ''} ${id || ''}`.trim()
  return EPHEMERAL_PATTERNS.some((pattern) => pattern.test(combined))
}

/**
 * Classifies a question into a recurrent semantic category, or returns null if not recurrent.
 */
export function classifyQuestionSemantic(question: {
  id?: string
  label: string
  type: string
}): SemanticCategory | null {
  const label = (question.label || '').trim()
  const id = (question.id || '').trim()
  const type = (question.type || '').trim().toLowerCase()

  // 1. If it matches any ephemeral pattern, it must NEVER be classified as a recurrent field.
  // Example: "Name three things you expect to learn" contains "name" and "learn" -> Must be excluded!
  if (isEphemeralQuestion(label, id)) {
    return null
  }

  // 2. Email detection
  if (
    type === 'email' ||
    /^(your\s*)?e-?mail(\s*address)?$/i.test(label) ||
    /email|e-mail/i.test(label) ||
    /email/i.test(id)
  ) {
    return 'email'
  }

  // 3. Phone detection
  if (
    type === 'phone' ||
    /^(your\s*)?(phone|mobile|telephone|whatsapp|contact)(\s*(number|no\.?))?$/i.test(label) ||
    /(phone|mobile|whatsapp)/i.test(label) ||
    /(phone|mobile|whatsapp)/i.test(id)
  ) {
    return 'phone'
  }

  // 4. Name detection (Full Name, First Name, Attendee Name)
  if (
    type === 'text' &&
    !/(company|organization|organisation|school|university|employer|event)/i.test(label)
  ) {
    if (
      /^(your\s*|full\s*|first\s*|attendee\s*)?name$/i.test(label) ||
      /full\s*name/i.test(label) ||
      /\bname\b/i.test(label) ||
      /^(name|fullName|first_name)$/i.test(id)
    ) {
      return 'name'
    }
  }

  // 5. Location / City / County
  if (
    type === 'text' &&
    (/^(your\s*)?(location|city|town|residence|county|country|where\s*are\s*you\s*(based|located))\??$/i.test(label) ||
      /\b(city|county|town|residence)\b/i.test(label) ||
      /^(location|city|county)$/i.test(id))
  ) {
    return 'location'
  }

  // 6. Organization / Company / Institution
  if (
    type === 'text' &&
    (/^(your\s*)?(company|organization|organisation|institution|school|university|employer)(\s*name)?$/i.test(label) ||
      /\b(company|organization|organisation|institution)\b/i.test(label) ||
      /^(company|organization|org)$/i.test(id))
  ) {
    return 'organization'
  }

  // 7. Job Title / Role / Position
  if (
    type === 'text' &&
    (/^(your\s*)?(job\s*title|title|role|designation|occupation|position)$/i.test(label) ||
      /job\s*title|designation/i.test(label) ||
      /^(jobTitle|title|role)$/i.test(id))
  ) {
    return 'jobTitle'
  }

  return null
}

/**
 * Returns the appropriate standard HTML5 / W3C autocomplete token for browser / password-manager autofill.
 */
export function getAutocompleteTokenForQuestion(question: {
  id?: string
  label: string
  type: string
}): string | undefined {
  const semantic = classifyQuestionSemantic(question)
  switch (semantic) {
    case 'name':
      return 'name'
    case 'email':
      return 'email'
    case 'phone':
      return 'tel'
    case 'location':
      return 'address-level2'
    case 'organization':
      return 'organization'
    case 'jobTitle':
      return 'organization-title'
    default:
      return undefined
  }
}

/**
 * Reads the attendee profile from client-side localStorage.
 * Returns null if not in browser, storage empty, corrupted, or user opted out.
 */
export function getSavedAttendeeProfile(): AttendeeProfile | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  try {
    const isOptedOut = window.localStorage.getItem(ATTENDEE_REMEMBER_OPT_OUT_KEY) === 'true'
    if (isOptedOut) {
      return null
    }

    const raw = window.localStorage.getItem(ATTENDEE_PROFILE_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    // Validate that at least one recognizable field exists
    const hasData = Boolean(
      parsed.name ||
      parsed.email ||
      parsed.phone ||
      parsed.location ||
      parsed.organization ||
      parsed.jobTitle
    )

    if (!hasData) return null

    return {
      name: typeof parsed.name === 'string' ? parsed.name.slice(0, 120) : undefined,
      email: typeof parsed.email === 'string' ? parsed.email.slice(0, 160) : undefined,
      phone: typeof parsed.phone === 'string' ? parsed.phone.slice(0, 40) : undefined,
      location: typeof parsed.location === 'string' ? parsed.location.slice(0, 100) : undefined,
      organization: typeof parsed.organization === 'string' ? parsed.organization.slice(0, 120) : undefined,
      jobTitle: typeof parsed.jobTitle === 'string' ? parsed.jobTitle.slice(0, 100) : undefined,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return null
  }
}

/**
 * Saves or updates recurrent fields into the attendee's local device profile.
 */
export function saveAttendeeProfile(incoming: Partial<AttendeeProfile>): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false
  }

  try {
    const isOptedOut = window.localStorage.getItem(ATTENDEE_REMEMBER_OPT_OUT_KEY) === 'true'
    if (isOptedOut) {
      return false
    }

    const existing = getSavedAttendeeProfile() || { updatedAt: Date.now() }

    const updated: AttendeeProfile = {
      name: (incoming.name !== undefined ? incoming.name : existing.name)?.trim().slice(0, 120) || undefined,
      email: (incoming.email !== undefined ? incoming.email : existing.email)?.trim().slice(0, 160) || undefined,
      phone: (incoming.phone !== undefined ? incoming.phone : existing.phone)?.trim().slice(0, 40) || undefined,
      location: (incoming.location !== undefined ? incoming.location : existing.location)?.trim().slice(0, 100) || undefined,
      organization: (incoming.organization !== undefined ? incoming.organization : existing.organization)?.trim().slice(0, 120) || undefined,
      jobTitle: (incoming.jobTitle !== undefined ? incoming.jobTitle : existing.jobTitle)?.trim().slice(0, 100) || undefined,
      updatedAt: Date.now(),
    }

    // Clean empty undefined fields
    Object.keys(updated).forEach((k) => {
      const key = k as keyof AttendeeProfile
      if (updated[key] === undefined || updated[key] === '') {
        delete updated[key]
      }
    })

    window.localStorage.setItem(ATTENDEE_PROFILE_STORAGE_KEY, JSON.stringify(updated))
    return true
  } catch {
    return false
  }
}

/**
 * Permanently clears the saved attendee profile from this device.
 */
export function clearSavedAttendeeProfile(): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.removeItem(ATTENDEE_PROFILE_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

/**
 * Sets the attendee's preference to opt out of device remembering.
 */
export function setAttendeeRememberOptOut(optOut: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    if (optOut) {
      window.localStorage.setItem(ATTENDEE_REMEMBER_OPT_OUT_KEY, 'true')
      window.localStorage.removeItem(ATTENDEE_PROFILE_STORAGE_KEY)
    } else {
      window.localStorage.removeItem(ATTENDEE_REMEMBER_OPT_OUT_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Checks whether the user has opted out of remembering on this device.
 */
export function isAttendeeRememberOptedOut(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false
  try {
    return window.localStorage.getItem(ATTENDEE_REMEMBER_OPT_OUT_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Extracts recurrent profile fields from an attendee's submitted answers.
 * Ignores all non-recurrent or ephemeral fields.
 */
export function extractProfileFromAnswers(
  questions: Array<{ id: string; label: string; type: string }>,
  answers: Record<string, string>,
  fallbackEmail?: string
): Partial<AttendeeProfile> {
  const result: Partial<AttendeeProfile> = {}

  for (const q of questions) {
    const val = (answers[q.id] || '').trim()
    if (!val) continue

    const semantic = classifyQuestionSemantic(q)
    if (!semantic) continue

    if (semantic === 'name' && !result.name) result.name = val
    if (semantic === 'email' && !result.email) result.email = val
    if (semantic === 'phone' && !result.phone) result.phone = val
    if (semantic === 'location' && !result.location) result.location = val
    if (semantic === 'organization' && !result.organization) result.organization = val
    if (semantic === 'jobTitle' && !result.jobTitle) result.jobTitle = val
  }

  if (!result.email && fallbackEmail?.trim()) {
    result.email = fallbackEmail.trim()
  }

  return result
}

/**
 * Matches an attendee profile with event questions to generate pre-fill values.
 */
export function matchAnswersWithProfile(
  questions: Array<{ id: string; label: string; type: string }>,
  profile: Partial<AttendeeProfile>,
  currentAnswers: Record<string, string> = {}
): { prefilledAnswers: Record<string, string>; prefilledFieldsCount: number } {
  const prefilledAnswers: Record<string, string> = { ...currentAnswers }
  let prefilledFieldsCount = 0

  for (const q of questions) {
    // Do not overwrite non-empty existing answers
    if (prefilledAnswers[q.id]?.trim()) continue

    const semantic = classifyQuestionSemantic(q)
    if (!semantic) continue

    const profileValue = profile[semantic]
    if (typeof profileValue === 'string' && profileValue.trim()) {
      prefilledAnswers[q.id] = profileValue.trim()
      prefilledFieldsCount++
    }
  }

  return { prefilledAnswers, prefilledFieldsCount }
}

/**
 * Extracts profile information from URL query parameters (Layer 3 Campaign Pre-filling).
 */
export function extractProfileFromSearchParams(
  searchParams: { get(key: string): string | null }
): Partial<AttendeeProfile> {
  const name =
    searchParams.get('name') ||
    searchParams.get('full_name') ||
    searchParams.get('fullName') ||
    searchParams.get('attendee_name') ||
    undefined

  const email =
    searchParams.get('email') ||
    searchParams.get('e-mail') ||
    undefined

  const phone =
    searchParams.get('phone') ||
    searchParams.get('tel') ||
    searchParams.get('mobile') ||
    searchParams.get('whatsapp') ||
    undefined

  const location =
    searchParams.get('location') ||
    searchParams.get('city') ||
    searchParams.get('county') ||
    undefined

  const organization =
    searchParams.get('company') ||
    searchParams.get('organization') ||
    searchParams.get('organisation') ||
    searchParams.get('school') ||
    undefined

  const jobTitle =
    searchParams.get('title') ||
    searchParams.get('job_title') ||
    searchParams.get('role') ||
    undefined

  return {
    name: name?.trim() || undefined,
    email: email?.trim() || undefined,
    phone: phone?.trim() || undefined,
    location: location?.trim() || undefined,
    organization: organization?.trim() || undefined,
    jobTitle: jobTitle?.trim() || undefined,
  }
}
