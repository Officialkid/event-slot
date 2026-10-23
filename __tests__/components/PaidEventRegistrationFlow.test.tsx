import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import RegistrationForm from '@/app/(attendee)/[username]/RegistrationForm'

const paidEvent = {
  slug: 'dev-summit-2026',
  title: 'Dev Summit 2026',
  description: 'Annual software engineering summit.',
  confirmedCount: 42,
  questions: [
    { id: 'fullName', label: 'Full name', type: 'text', required: true },
    { id: 'role', label: 'Preferred track', type: 'select', required: true, options: ['Frontend', 'Backend'] },
  ],
  organizerEmail: 'team@eventslot.com',
  organizerName: 'Dev Summit Team',
  createdAt: '2026-08-01T08:00:00.000Z',
  isPaid: true,
  attendeeConsentEnabled: true,
  attendeeConsentText: 'I consent to data collection for event pass issuance.',
  ticketTiers: [
    {
      id: 'tier-early-bird',
      name: 'Early Bird',
      priceKes: 500,
      currency: 'KES',
      capacity: 50,
      soldCount: 15,
      waitlistCount: 0,
      badgeColor: '#C8F55A',
      textColor: '#0A0A0A',
      metallic: false,
      prestige: 1,
      bundleSize: 1,
      description: 'Standard admission for early attendees.',
    },
    {
      id: 'tier-vip-pass',
      name: 'VIP Pass',
      priceKes: 2500,
      currency: 'KES',
      capacity: 20,
      soldCount: 5,
      waitlistCount: 0,
      badgeColor: '#FFD700',
      textColor: '#0A0A0A',
      metallic: true,
      prestige: 2,
      bundleSize: 1,
      description: 'Access to keynote lounge, speaker dinner and VIP seating.',
    },
    {
      id: 'tier-sold-out',
      name: 'Executive Pass',
      priceKes: 5000,
      currency: 'KES',
      capacity: 10,
      soldCount: 10,
      waitlistCount: 0,
      badgeColor: '#E2E8F0',
      textColor: '#0A0A0A',
      metallic: true,
      prestige: 3,
      bundleSize: 1,
      description: 'Exclusive 1-on-1 networking.',
    },
  ],
}

describe('PaidEventRegistrationFlow Component Integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/register/draft')) {
        return { ok: true, json: async () => ({ draft: null }) }
      }
      return { ok: true, json: async () => ({ success: true }) }
    }) as typeof fetch
    window.localStorage.clear()
    sessionStorage.clear()
    document.documentElement.setAttribute('data-theme', 'dark')
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('renders ticket tier selector on welcome step with correct prices, capacities, and sold-out states', () => {
    render(<RegistrationForm event={paidEvent} />)

    expect(screen.getByText('Choose your ticket')).toBeInTheDocument()
    expect(screen.getAllByText('Early Bird').length).toBeGreaterThan(0)
    expect(screen.getAllByText('VIP Pass').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Executive Pass').length).toBeGreaterThan(0)

    // Pricing display
    expect(screen.getAllByText('KES 500').length).toBeGreaterThan(0)
    expect(screen.getAllByText('KES 2,500').length).toBeGreaterThan(0)
    expect(screen.getAllByText('KES 5,000').length).toBeGreaterThan(0)

    // Spots left
    expect(screen.getByText('35 spots left')).toBeInTheDocument()
    expect(screen.getByText('15 spots left')).toBeInTheDocument()
    expect(screen.getByText('Sold Out')).toBeInTheDocument()
  })

  it('allows selecting an available tier and proceeds through wizard steps', async () => {
    render(<RegistrationForm event={paidEvent} />)

    // Select VIP Pass
    const vipCard = screen.getAllByText('VIP Pass')[0]
    fireEvent.click(vipCard)

    // Advance from Welcome to Personal Details
    const startBtn = screen.getByRole('button', { name: /start registration/i })
    expect(startBtn).not.toBeDisabled()
    fireEvent.click(startBtn)

    // In Personal Details step
    expect(screen.getByRole('heading', { name: /personal details/i })).toBeInTheDocument()
    const nameInput = screen.getByLabelText(/full name/i)
    fireEvent.change(nameInput, { target: { value: 'Ada Lovelace' } })
    const emailInput = screen.getByLabelText(/email address/i)
    fireEvent.change(emailInput, { target: { value: 'ada@example.com' } })

    // Advance to Event Questions
    const continueBtn = screen.getByRole('button', { name: /continue/i })
    fireEvent.click(continueBtn)

    // In Event Questions step
    expect(screen.getByRole('heading', { name: /event questions/i })).toBeInTheDocument()
    const backendOption = screen.getByText('Backend')
    fireEvent.click(backendOption)

    // Advance to Review & Confirm
    const continueReviewBtn = screen.getByRole('button', { name: /continue/i })
    fireEvent.click(continueReviewBtn)

    // In Review & Confirm step
    expect(screen.getByRole('heading', { name: /review & confirm/i })).toBeInTheDocument()
    expect(screen.getByText('Selected Ticket Tier')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change tier/i })).toBeInTheDocument()

    // Button label reflects the selected tier and price
    const paymentBtn = screen.getByRole('button', { name: /proceed to payment \(kes 2,500\)/i })
    expect(paymentBtn).toBeInTheDocument()
  })

  it('initiates paid checkout via POST /api/paid-events/checkout with selected ticketTierId', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (url: string, options?: any) => {
      if (typeof url === 'string' && url.includes('/api/paid-events/checkout')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            orderId: 'order-dev-999',
            url: 'https://checkout.paystack.com/access-dev-999',
          }),
        }
      }
      return { ok: true, json: async () => ({ draft: null }) }
    })

    // Render with compactHeader: true to verify inline tier selector on personal details
    const { container } = render(<RegistrationForm event={paidEvent} compactHeader={true} />)

    // Tier selector is directly accessible
    expect(screen.getByText('Choose your ticket')).toBeInTheDocument()
    fireEvent.click(screen.getAllByText('VIP Pass')[0])

    // Fill personal details
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Marie Curie' } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'marie@example.com' } })

    // Step to questions
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    // Step to review
    fireEvent.click(screen.getByText('Frontend'))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    // Consent checkbox
    const consentBox = container.querySelector('#consent-data-processing') as HTMLInputElement
    expect(consentBox).toBeTruthy()
    fireEvent.click(consentBox)

    // Submit payment
    const submitBtn = screen.getByRole('button', { name: /proceed to payment \(kes 2,500\)/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/paid-events/checkout',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"ticketTierId":"tier-vip-pass"'),
        })
      )
    })
  })

  it('preserves free registration submission to /api/register without paid checkout redirect', async () => {
    const freeEvent = {
      ...paidEvent,
      isPaid: false,
      ticketTiers: [],
    }

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (url: string, options?: any) => {
      if (typeof url === 'string' && url.includes('/api/register') && !url.includes('/api/register/draft')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            results: [
              {
                status: 'confirmed',
                registrationId: 'reg-free-1',
                registrationNumber: 1,
                confirmationCode: 'FREE-CONF-123',
              },
            ],
          }),
        }
      }
      return { ok: true, json: async () => ({ draft: null }) }
    })

    const { container } = render(<RegistrationForm event={freeEvent} compactHeader={true} />)

    // Ticket tier selector is NOT rendered for free events
    expect(screen.queryByText('Choose your ticket')).not.toBeInTheDocument()

    // Fill personal details
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Grace Hopper' } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'grace@example.com' } })

    // Step to questions
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByText('Backend'))

    // Step to review
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    // Check consent and submit free registration
    const consentBox = container.querySelector('#consent-data-processing') as HTMLInputElement
    expect(consentBox).toBeTruthy()
    fireEvent.click(consentBox)

    const submitBtn = screen.getByRole('button', { name: /^submit$/i })
    expect(submitBtn).toBeInTheDocument()
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/register',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"eventSlug":"dev-summit-2026"'),
        })
      )
    })

    // Verifies confirmed ticket confirmation UI
    await waitFor(() => {
      expect(screen.getByText("You're in!")).toBeInTheDocument()
      expect(screen.getByText('Registration #0001')).toBeInTheDocument()
    })
  })
})
