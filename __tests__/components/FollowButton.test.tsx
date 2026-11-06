/** @jest-environment jsdom */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { FollowButton } from '@/components/following/FollowButton'
import { useSession } from 'next-auth/react'

describe('FollowButton Component — UX Verification', () => {
  const defaultProps = {
    organiserUsername: 'devcraft',
    organiserName: 'DevCraft Nairobi',
    initialFollowerCount: 15,
    initialIsFollowing: false,
    showFollowerCountPublicly: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('renders initial unauthenticated state with follow button and follower count', () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        organiserUsername: 'devcraft',
        followerCount: 15,
        isFollowing: false,
        notifyNewEvents: true,
        showFollowerCountPublicly: true,
        isSelf: false,
      }),
    })

    render(<FollowButton {...defaultProps} />)

    const followBtn = screen.getByRole('button', { name: /Follow DevCraft Nairobi/i })
    expect(followBtn).toBeInTheDocument()
    expect(followBtn).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('15 followers')).toBeInTheDocument()
  })

  it('shows auth modal when an unauthenticated user clicks follow', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        organiserUsername: 'devcraft',
        followerCount: 15,
        isFollowing: false,
        notifyNewEvents: true,
        isSelf: false,
      }),
    })

    render(<FollowButton {...defaultProps} />)

    const followBtn = screen.getByRole('button', { name: /Follow DevCraft Nairobi/i })
    fireEvent.click(followBtn)

    // Modal should be opened
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/Sign up to follow DevCraft Nairobi/i)).toBeInTheDocument()
    })
  })

  it('shows auth modal when unauthenticated user clicks notification toggle', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        organiserUsername: 'devcraft',
        followerCount: 15,
        isFollowing: false,
        isSelf: false,
      }),
    })

    render(<FollowButton {...defaultProps} />)

    const notifBtn = screen.getByTitle(/Get email notifications when DevCraft Nairobi publishes new events/i)
    fireEvent.click(notifBtn)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('renders host badge and no follow buttons when user is the organizer (isSelf)', async () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: { user: { id: 'org_user_1', email: 'org@devcraft.com' } },
      status: 'authenticated',
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        isSelf: true,
        followerCount: 15,
      }),
    })

    render(<FollowButton {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/You \(Organizer\)/i)).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /Follow/i })).not.toBeInTheDocument()
  })

  it('allows an authenticated user to follow and updates count optimistically and authoritatively', async () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: { user: { id: 'user_123', email: 'attendee@example.com' } },
      status: 'authenticated',
    })

    const fetchMock = global.fetch as jest.Mock
    // Initial fetch
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        isFollowing: false,
        followerCount: 15,
        notifyNewEvents: true,
        isSelf: false,
      }),
    })

    // Follow POST request
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        isFollowing: true,
        notifyNewEvents: true,
        followerCount: 16,
      }),
    })

    render(<FollowButton {...defaultProps} />)

    const followBtn = screen.getByRole('button', { name: /Follow DevCraft Nairobi/i })
    expect(followBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(followBtn)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Unfollow DevCraft Nairobi/i })).toBeInTheDocument()
      expect(screen.getByText('16 followers')).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/organizers/devcraft/follow',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyNewEvents: true }),
      })
    )
  })

  it('allows an authenticated user to unfollow and decrements follower count', async () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: { user: { id: 'user_123', email: 'attendee@example.com' } },
      status: 'authenticated',
    })

    const fetchMock = global.fetch as jest.Mock
    // Initial fetch returns already following
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        isFollowing: true,
        followerCount: 20,
        notifyNewEvents: true,
        isSelf: false,
      }),
    })

    // Unfollow DELETE request
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        isFollowing: false,
        followerCount: 19,
      }),
    })

    render(<FollowButton {...defaultProps} initialIsFollowing={true} initialFollowerCount={20} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Unfollow DevCraft Nairobi/i })).toBeInTheDocument()
    })

    const unfollowBtn = screen.getByRole('button', { name: /Unfollow DevCraft Nairobi/i })

    await act(async () => {
      fireEvent.click(unfollowBtn)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Follow DevCraft Nairobi/i })).toBeInTheDocument()
      expect(screen.getByText('19 followers')).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/organizers/devcraft/follow',
      expect.objectContaining({
        method: 'DELETE',
      })
    )
  })

  it('reverts optimistic state if follow request fails or returns an error', async () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: { user: { id: 'user_123', email: 'attendee@example.com' } },
      status: 'authenticated',
    })

    const fetchMock = global.fetch as jest.Mock
    // Initial status
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        isFollowing: false,
        followerCount: 10,
        isSelf: false,
      }),
    })

    // Failed follow POST request
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Network failure',
      }),
    })

    render(<FollowButton {...defaultProps} initialFollowerCount={10} initialIsFollowing={false} />)

    const followBtn = screen.getByRole('button', { name: /Follow DevCraft Nairobi/i })

    await act(async () => {
      fireEvent.click(followBtn)
    })

    // State should revert back to unfollowed and 10 followers
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Follow DevCraft Nairobi/i })).toBeInTheDocument()
      expect(screen.getByText('10 followers')).toBeInTheDocument()
    })
  })

  it('prevents duplicate submissions by disabling button while loading', async () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: { user: { id: 'user_123', email: 'attendee@example.com' } },
      status: 'authenticated',
    })

    let resolveFollowPromise: (val: unknown) => void
    const followPromise = new Promise((resolve) => {
      resolveFollowPromise = resolve
    })

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, isFollowing: false, followerCount: 5, isSelf: false }),
    })
    fetchMock.mockImplementationOnce(() => followPromise)

    render(<FollowButton {...defaultProps} initialFollowerCount={5} initialIsFollowing={false} />)

    const followBtn = screen.getByRole('button', { name: /Follow DevCraft Nairobi/i })

    // Click once
    fireEvent.click(followBtn)

    // Button should be disabled during flight
    expect(followBtn).toBeDisabled()

    // Subsequent click should not trigger another fetch
    fireEvent.click(followBtn)
    expect(fetchMock).toHaveBeenCalledTimes(2) // 1 initial GET + 1 POST

    // Resolve in flight promise
    await act(async () => {
      resolveFollowPromise!({
        ok: true,
        json: async () => ({
          success: true,
          isFollowing: true,
          followerCount: 6,
        }),
      })
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Unfollow DevCraft Nairobi/i })).not.toBeDisabled()
    })
  })

  it('toggles notification preference when following', async () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: { user: { id: 'user_123', email: 'attendee@example.com' } },
      status: 'authenticated',
    })

    const fetchMock = global.fetch as jest.Mock
    // Initial state: following with notifications enabled
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        isFollowing: true,
        notifyNewEvents: true,
        followerCount: 10,
        isSelf: false,
      }),
    })

    // Notification update request (mute)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        isFollowing: true,
        notifyNewEvents: false,
        followerCount: 10,
      }),
    })

    render(<FollowButton {...defaultProps} initialIsFollowing={true} initialFollowerCount={10} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Unfollow DevCraft Nairobi/i })).toBeInTheDocument()
    })

    const notifBtn = screen.getByTitle(/Email notifications ON for DevCraft Nairobi \(click to mute\)/i)
    expect(notifBtn).toHaveAttribute('aria-pressed', 'true')

    await act(async () => {
      fireEvent.click(notifBtn)
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/organizers/devcraft/follow',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ notifyNewEvents: false }),
        })
      )
    })
  })
})
