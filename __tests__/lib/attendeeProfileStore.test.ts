/** @jest-environment jsdom */

import {
  classifyQuestionSemantic,
  isEphemeralQuestion,
  getAutocompleteTokenForQuestion,
  getSavedAttendeeProfile,
  saveAttendeeProfile,
  clearSavedAttendeeProfile,
  setAttendeeRememberOptOut,
  isAttendeeRememberOptedOut,
  extractProfileFromAnswers,
  matchAnswersWithProfile,
  extractProfileFromSearchParams,
  ATTENDEE_PROFILE_STORAGE_KEY,
} from '@/lib/attendeeProfileStore'

describe('Attendee Profile Store & Semantic Classifier (Privacy-Guarded Autofill)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.restoreAllMocks()
  })

  describe('Semantic Classification of Recurrent vs Ephemeral Fields', () => {
    it('correctly classifies standard recurrent contact fields', () => {
      expect(classifyQuestionSemantic({ label: 'Full Name', type: 'text' })).toBe('name')
      expect(classifyQuestionSemantic({ label: 'Your Name', type: 'text' })).toBe('name')
      expect(classifyQuestionSemantic({ label: 'First Name', type: 'text' })).toBe('name')
      expect(classifyQuestionSemantic({ label: 'Email Address', type: 'email' })).toBe('email')
      expect(classifyQuestionSemantic({ label: 'Phone Number', type: 'phone' })).toBe('phone')
      expect(classifyQuestionSemantic({ label: 'WhatsApp Number', type: 'text' })).toBe('phone')
      expect(classifyQuestionSemantic({ label: 'City of Residence', type: 'text' })).toBe('location')
      expect(classifyQuestionSemantic({ label: 'Where are you based?', type: 'text' })).toBe('location')
      expect(classifyQuestionSemantic({ label: 'Company / Organization', type: 'text' })).toBe('organization')
      expect(classifyQuestionSemantic({ label: 'Job Title', type: 'text' })).toBe('jobTitle')
    })

    it('strictly EXCLUDES and rejects ephemeral event-specific questions from recurring storage', () => {
      // Expectations and goals must NEVER be treated as recurring
      expect(classifyQuestionSemantic({ label: 'What are your expectations for this event?', type: 'text' })).toBeNull()
      expect(classifyQuestionSemantic({ label: 'What do you hope to learn?', type: 'textarea' })).toBeNull()
      expect(classifyQuestionSemantic({ label: 'What is your primary goal for attending?', type: 'text' })).toBeNull()

      // Adversarial test: contains the word "name" but is an expectation!
      expect(classifyQuestionSemantic({ label: 'Name 3 expectations you have for this workshop', type: 'text' })).toBeNull()
      expect(isEphemeralQuestion('Name 3 expectations you have for this workshop')).toBe(true)

      // Dietary and health questions
      expect(classifyQuestionSemantic({ label: 'Any dietary requirements or allergies?', type: 'text' })).toBeNull()
      expect(classifyQuestionSemantic({ label: 'Do you require vegan food?', type: 'text' })).toBeNull()

      // Merchandise / Apparel sizing
      expect(classifyQuestionSemantic({ label: 'T-Shirt Size', type: 'text' })).toBeNull()
      expect(classifyQuestionSemantic({ label: 'Hoodie Size (S/M/L/XL)', type: 'text' })).toBeNull()

      // Tracks and sessions
      expect(classifyQuestionSemantic({ label: 'Which breakout session will you attend?', type: 'text' })).toBeNull()
      expect(classifyQuestionSemantic({ label: 'Select your track choice', type: 'text' })).toBeNull()

      // Marketing surveys
      expect(classifyQuestionSemantic({ label: 'How did you hear about this event?', type: 'text' })).toBeNull()
    })

    it('maps recurrent fields to appropriate W3C / HTML5 autocomplete tokens', () => {
      expect(getAutocompleteTokenForQuestion({ label: 'Full Name', type: 'text' })).toBe('name')
      expect(getAutocompleteTokenForQuestion({ label: 'Email', type: 'email' })).toBe('email')
      expect(getAutocompleteTokenForQuestion({ label: 'Phone', type: 'phone' })).toBe('tel')
      expect(getAutocompleteTokenForQuestion({ label: 'City', type: 'text' })).toBe('address-level2')
      expect(getAutocompleteTokenForQuestion({ label: 'Company', type: 'text' })).toBe('organization')
      expect(getAutocompleteTokenForQuestion({ label: 'Job Title', type: 'text' })).toBe('organization-title')
      expect(getAutocompleteTokenForQuestion({ label: 'Expectations', type: 'textarea' })).toBeUndefined()
    })
  })

  describe('Local Storage Profile Management & Privacy Controls', () => {
    it('saves recurrent profile fields to localStorage and retrieves them safely', () => {
      const saved = saveAttendeeProfile({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+254712345678',
        location: 'Nairobi',
        organization: 'Acme Corp',
      })

      expect(saved).toBe(true)
      const profile = getSavedAttendeeProfile()
      expect(profile).not.toBeNull()
      expect(profile?.name).toBe('Jane Doe')
      expect(profile?.email).toBe('jane@example.com')
      expect(profile?.phone).toBe('+254712345678')
      expect(profile?.location).toBe('Nairobi')
      expect(profile?.organization).toBe('Acme Corp')
      expect(typeof profile?.updatedAt).toBe('number')
    })

    it('permanently clears profile when clearSavedAttendeeProfile is called', () => {
      saveAttendeeProfile({ name: 'Jane Doe', email: 'jane@example.com' })
      expect(getSavedAttendeeProfile()).not.toBeNull()

      clearSavedAttendeeProfile()
      expect(getSavedAttendeeProfile()).toBeNull()
      expect(window.localStorage.getItem(ATTENDEE_PROFILE_STORAGE_KEY)).toBeNull()
    })

    it('respects user opt-out and refuses to save or return data when opted out', () => {
      setAttendeeRememberOptOut(true)
      expect(isAttendeeRememberOptedOut()).toBe(true)

      const saved = saveAttendeeProfile({ name: 'Refused User', email: 'refused@example.com' })
      expect(saved).toBe(false)
      expect(getSavedAttendeeProfile()).toBeNull()

      // Opt back in
      setAttendeeRememberOptOut(false)
      expect(isAttendeeRememberOptedOut()).toBe(false)
    })
  })

  describe('Extraction and Matching against Event Questions', () => {
    const questions = [
      { id: 'q_name', label: 'Full Name', type: 'text' },
      { id: 'q_email', label: 'Email Address', type: 'email' },
      { id: 'q_phone', label: 'Phone Number', type: 'phone' },
      { id: 'q_expectations', label: 'What are your expectations for this summit?', type: 'textarea' },
      { id: 'q_diet', label: 'Dietary requirements', type: 'text' },
      { id: 'q_city', label: 'Where are you based (City)?', type: 'text' },
    ]

    it('extracts ONLY recurrent fields from submitted answers and ignores ephemeral ones', () => {
      const answers = {
        q_name: 'Alex Smith',
        q_email: 'alex@company.org',
        q_phone: '+254700000000',
        q_expectations: 'I want to network with developers and learn AI.',
        q_diet: 'No peanuts, vegetarian',
        q_city: 'Mombasa',
      }

      const extracted = extractProfileFromAnswers(questions, answers)

      expect(extracted.name).toBe('Alex Smith')
      expect(extracted.email).toBe('alex@company.org')
      expect(extracted.phone).toBe('+254700000000')
      expect(extracted.location).toBe('Mombasa')

      // Ensure expectations and diet are NEVER extracted into the reusable profile!
      expect((extracted as any).expectations).toBeUndefined()
      expect((extracted as any).q_expectations).toBeUndefined()
      expect((extracted as any).diet).toBeUndefined()
    })

    it('pre-fills matching recurring fields into blank answers without overwriting existing input', () => {
      const profile = {
        name: 'Alex Smith',
        email: 'alex@company.org',
        phone: '+254700000000',
        location: 'Mombasa',
        updatedAt: Date.now(),
      }

      // Existing answers where user already manually typed a custom email
      const currentAnswers = {
        q_email: 'custom.work@company.org',
      }

      const { prefilledAnswers, prefilledFieldsCount } = matchAnswersWithProfile(
        questions,
        profile,
        currentAnswers
      )

      // Pre-filled blank fields
      expect(prefilledAnswers.q_name).toBe('Alex Smith')
      expect(prefilledAnswers.q_phone).toBe('+254700000000')
      expect(prefilledAnswers.q_city).toBe('Mombasa')

      // Did NOT overwrite user-typed email
      expect(prefilledAnswers.q_email).toBe('custom.work@company.org')

      // Ephemeral fields remain untouched/blank
      expect(prefilledAnswers.q_expectations).toBeUndefined()
      expect(prefilledAnswers.q_diet).toBeUndefined()

      expect(prefilledFieldsCount).toBe(3) // name, phone, city
    })

    it('extracts pre-fill parameters from URL search params (Layer 3)', () => {
      const params = new URLSearchParams('name=Bob+Marley&email=bob@reggae.com&phone=0799999999&city=Kingston')
      const profile = extractProfileFromSearchParams(params)

      expect(profile.name).toBe('Bob Marley')
      expect(profile.email).toBe('bob@reggae.com')
      expect(profile.phone).toBe('0799999999')
      expect(profile.location).toBe('Kingston')
    })
  })
})
