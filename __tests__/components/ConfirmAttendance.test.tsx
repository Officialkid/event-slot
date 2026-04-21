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
    render(<ConfirmAttendance eventId="test-event" />)
    expect(screen.getByText('Already Registered?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /find my registration/i })).toBeInTheDocument()
  })

  it('does not submit when email is empty', async () => {
    render(<ConfirmAttendance eventId="test-event" />)
    const submitBtn = screen.getByRole('button', { name: /find my registration/i })

    expect(submitBtn).toBeDisabled()
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})
