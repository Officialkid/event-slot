import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ConfirmAttendance from '@/components/attendance/ConfirmAttendance'

describe('ConfirmAttendance', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('renders the form', () => {
    render(<ConfirmAttendance eventSlug="test-event" />)
    expect(screen.getByText('Check your registration')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/your name or email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('does not submit when email is empty', async () => {
    render(<ConfirmAttendance eventSlug="test-event" />)
    const submitBtn = screen.getByRole('button', { name: /search/i })

    expect(submitBtn).toBeDisabled()
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})
