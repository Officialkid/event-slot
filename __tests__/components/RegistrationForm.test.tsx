import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import RegistrationForm from '@/app/(attendee)/[username]/RegistrationForm'

const baseEvent = {
  slug: 'restore-test',
  title: 'Volunteer Summit',
  description: 'A public form for community volunteers.',
  confirmedCount: 12,
  questions: [
    { id: 'fullName', label: 'Full name', type: 'text', required: true },
    { id: 'role', label: 'Preferred position', type: 'select', required: true, options: ['Media', 'Protocol'] },
  ],
  organizerEmail: 'organiser@example.com',
  organizerName: 'EventSlot Team',
  createdAt: '2026-07-15T08:00:00.000Z',
  isPaid: false,
}

describe('RegistrationForm', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    global.fetch = jest.fn() as typeof fetch
    window.localStorage.clear()
    sessionStorage.clear()
    document.documentElement.setAttribute('data-theme', 'dark')
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.resetAllMocks()
  })

  it('restores saved progress from the draft email and resaves the restored state', async () => {
    window.localStorage.setItem('eventslot-draft-email:restore-test', 'saved@example.com')

    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          draft: {
            answers: [
              { fullName: 'Ada Lovelace', role: 'Media' },
            ],
            baseEmails: ['saved@example.com'],
            consentDataProcessing: true,
            consentTransactional: true,
            consentMarketing: false,
            sendResponseCopy: true,
          },
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

    render(<RegistrationForm event={baseEvent} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ada Lovelace')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('Media')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('saved@example.com')).toHaveLength(2)
    expect(screen.getByText('Saved progress restored.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/register/draft?eventSlug=restore-test&email=saved%40example.com',
      { cache: 'no-store' },
    )

    await act(async () => {
      jest.advanceTimersByTime(900)
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/register/draft',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
  })

  it('restores and resaves multi-attendee draft progress', async () => {
    window.localStorage.setItem('eventslot-draft-email:restore-test', 'group@example.com')

    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          draft: {
            answers: [
              { fullName: 'Ada Lovelace', role: 'Media' },
              { fullName: 'Grace Hopper', role: 'Protocol' },
            ],
            baseEmails: ['group@example.com', 'guest@example.com'],
            consentDataProcessing: true,
            consentTransactional: true,
            consentMarketing: false,
            sendResponseCopy: false,
          },
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

    render(<RegistrationForm event={baseEvent} />)

    await waitFor(() => {
      expect(screen.getByText('Registering 2 people')).toBeInTheDocument()
    })

    const fullNameInputs = screen.getAllByLabelText(/full name/i) as HTMLInputElement[]
    const mediaRadios = screen.getAllByRole('radio', { name: 'Media' }) as HTMLInputElement[]
    const protocolRadios = screen.getAllByRole('radio', { name: 'Protocol' }) as HTMLInputElement[]
    const emailInputs = screen.getAllByLabelText(/email address/i) as HTMLInputElement[]

    expect(fullNameInputs).toHaveLength(2)
    expect(mediaRadios).toHaveLength(2)
    expect(protocolRadios).toHaveLength(2)
    expect(emailInputs).toHaveLength(2)

    expect(fullNameInputs[0].value).toBe('Ada Lovelace')
    expect(fullNameInputs[1].value).toBe('Grace Hopper')
    expect(mediaRadios[0]).toBeChecked()
    expect(protocolRadios[1]).toBeChecked()
    expect(emailInputs[0].value).toBe('group@example.com')
    expect(emailInputs[1].value).toBe('guest@example.com')

    fireEvent.change(fullNameInputs[1], { target: { value: 'Grace Brewster Hopper' } })

    await act(async () => {
      jest.advanceTimersByTime(900)
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/register/draft',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    const postCall = fetchMock.mock.calls.find(
      ([url, options]) => url === '/api/register/draft' && options?.method === 'POST',
    )
    const payload = JSON.parse(postCall?.[1]?.body as string)

    expect(payload.attendeeCount).toBe(2)
    expect(payload.answers).toHaveLength(2)
    expect(payload.answers[1].fullName).toBe('Grace Brewster Hopper')
    expect(payload.baseEmails).toEqual(['group@example.com', 'guest@example.com'])
  })

  it('updates saved draft payloads when attendees are added and removed after restore', async () => {
    window.localStorage.setItem('eventslot-draft-email:restore-test', 'group@example.com')

    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          draft: {
            answers: [{ fullName: 'Ada Lovelace', role: 'Media' }],
            baseEmails: ['group@example.com'],
            consentDataProcessing: true,
            consentTransactional: false,
            consentMarketing: false,
            sendResponseCopy: false,
          },
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

    render(<RegistrationForm event={baseEvent} />)

    await waitFor(() => {
      expect(screen.getByText('Registering 1 person')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /add attendee/i }))

    await waitFor(() => {
      expect(screen.getByText('Registering 2 people')).toBeInTheDocument()
    })

    const fullNameInputs = screen.getAllByLabelText(/full name/i) as HTMLInputElement[]
    const emailInputs = screen.getAllByLabelText(/email address/i) as HTMLInputElement[]

    fireEvent.change(fullNameInputs[1], { target: { value: 'Grace Hopper' } })
    fireEvent.click(screen.getAllByRole('radio', { name: 'Protocol' })[1])
    fireEvent.change(emailInputs[1], { target: { value: 'guest@example.com' } })

    await act(async () => {
      jest.advanceTimersByTime(900)
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/register/draft',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    const postCallsAfterAdd = fetchMock.mock.calls.filter(
      ([url, options]) => url === '/api/register/draft' && options?.method === 'POST',
    )
    const addPayload = JSON.parse(postCallsAfterAdd[postCallsAfterAdd.length - 1][1]?.body as string)

    expect(addPayload.attendeeCount).toBe(2)
    expect(addPayload.answers).toHaveLength(2)
    expect(addPayload.answers[1].fullName).toBe('Grace Hopper')
    expect(addPayload.answers[1].role).toBe('Protocol')
    expect(addPayload.baseEmails).toEqual(['group@example.com', 'guest@example.com'])

    fireEvent.click(screen.getByRole('button', { name: /remove attendee/i }))

    await waitFor(() => {
      expect(screen.getByText('Registering 1 person')).toBeInTheDocument()
    })

    await act(async () => {
      jest.advanceTimersByTime(900)
    })

    const postCallsAfterRemove = fetchMock.mock.calls.filter(
      ([url, options]) => url === '/api/register/draft' && options?.method === 'POST',
    )
    const removePayload = JSON.parse(postCallsAfterRemove[postCallsAfterRemove.length - 1][1]?.body as string)

    expect(removePayload.attendeeCount).toBe(1)
    expect(removePayload.answers).toHaveLength(1)
    expect(removePayload.answers[0].fullName).toBe('Ada Lovelace')
    expect(removePayload.baseEmails).toEqual(['group@example.com'])
  })

  it('renders the public form shell with theme-token based surfaces in light mode', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ draft: null }),
    })

    render(<RegistrationForm event={baseEvent} />)

    const introCopy = screen.getByText('Fill in the details below to secure your spot. You can save progress with your email and continue later.')
    expect(introCopy).toBeInTheDocument()

    const themedCard = introCopy.closest('div')
    expect(themedCard?.getAttribute('style')).toContain('var(--surface)')
    expect(themedCard?.getAttribute('style')).toContain('var(--text-primary)')

    expect(screen.getByText(/never submit passwords or sensitive financial credentials through this form/i)).toBeInTheDocument()
    expect(screen.getByText(/this form is created by the event organiser and hosted through eventslot/i)).toBeInTheDocument()
  })

  it('renders ticket tier selection and updates checkout button in paid events', () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ draft: null }),
    })

    const paidEvent = {
      ...baseEvent,
      isPaid: true,
      ticketTiers: [
        {
          id: 'tier-early-bird',
          name: 'Early Bird',
          badgeColor: '#C8F55A',
          textColor: '#0A0A0A',
          metallic: false,
          prestige: 1,
          priceKes: 1500,
          currency: 'KES',
          capacity: 50,
          soldCount: 10,
          waitlistCount: 0,
          bundleSize: 1,
        },
        {
          id: 'tier-vip',
          name: 'VIP Pass',
          badgeColor: '#FFD700',
          textColor: '#0A0A0A',
          metallic: true,
          prestige: 2,
          priceKes: 5000,
          currency: 'KES',
          capacity: 20,
          soldCount: 5,
          waitlistCount: 0,
          bundleSize: 1,
        },
      ],
    }

    render(<RegistrationForm event={paidEvent} />)

    expect(screen.getByText('Choose your ticket')).toBeInTheDocument()
    expect(screen.getByText('Paid Admission')).toBeInTheDocument()
    expect(screen.getAllByText('Early Bird').length).toBeGreaterThan(0)
    expect(screen.getAllByText('VIP Pass').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /start registration/i })).toBeInTheDocument()
  })

  it('clears the restored draft locally and remotely', async () => {
    window.localStorage.setItem('eventslot-draft-email:restore-test', 'saved@example.com')

    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          draft: {
            answers: [{ fullName: 'Ada Lovelace', role: 'Media' }],
            baseEmails: ['saved@example.com'],
            consentDataProcessing: true,
            consentTransactional: false,
            consentMarketing: false,
            sendResponseCopy: false,
          },
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

    render(<RegistrationForm event={baseEvent} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ada Lovelace')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /clear form/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/register/draft?eventSlug=restore-test&email=saved%40example.com',
        { method: 'DELETE' },
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Saved progress cleared.')).toBeInTheDocument()
    })
    expect(window.localStorage.getItem('eventslot-draft-email:restore-test')).toBeNull()
  })

  it('renders the confirmed success state after submitting a free registration', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: [
          {
            status: 'confirmed',
            registrationId: 'reg-confirmed',
            registrationNumber: 12,
            confirmationCode: 'CONF-123',
          },
        ],
      }),
    })

    render(<RegistrationForm event={{ ...baseEvent, attendeeConsentEnabled: true }} />)

    // Step 0: Welcome
    fireEvent.click(screen.getByRole('button', { name: /start registration/i }))

    // Step 1: Personal Details
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada Lovelace' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    // Step 2: Event Questions
    fireEvent.click(screen.getByRole('radio', { name: 'Media' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    // Step 3: Review & Consent
    fireEvent.click(screen.getByRole('checkbox', { name: /i consent to my data being collected/i }))
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }))

    await waitFor(() => {
      expect(screen.getByText("You're in!")).toBeInTheDocument()
    })

    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Registration #0012')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view & download ticket/i })).toHaveAttribute(
      'href',
      '/register/success/CONF-123',
    )
  })

  it('renders the waitlist state and saves a notification email after submitting', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: [
            {
              status: 'waitlist',
              registrationId: 'reg-waitlist',
              registrationNumber: 8,
              waitlistPosition: 4,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

    render(<RegistrationForm event={{ ...baseEvent, attendeeConsentEnabled: true }} />)

    // Step 0: Welcome
    fireEvent.click(screen.getByRole('button', { name: /start registration/i }))

    // Step 1: Personal Details
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Grace Hopper' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    // Step 2: Event Questions
    fireEvent.click(screen.getByRole('radio', { name: 'Protocol' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    // Step 3: Review & Consent
    fireEvent.click(screen.getByRole('checkbox', { name: /i consent to my data being collected/i }))
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }))

    await waitFor(() => {
      expect(screen.getByText("You're on the waitlist")).toBeInTheDocument()
    })

    expect(screen.getByText('Waitlist #4')).toBeInTheDocument()
    expect(screen.getByText(/enter your email so we can notify you if a slot opens/i)).toBeInTheDocument()

    const waitlistEmailInputs = screen.getAllByPlaceholderText('your@email.com')
    fireEvent.change(waitlistEmailInputs[waitlistEmailInputs.length - 1], {
      target: { value: 'waitlist@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /notify me/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/registrations/reg-waitlist',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/we will notify you if a slot opens/i)).toBeInTheDocument()
    })
  })
})
