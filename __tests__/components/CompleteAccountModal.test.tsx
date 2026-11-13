/** @jest-environment jsdom */

import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CompleteAccountModal } from "@/components/onboarding/CompleteAccountModal"
import { useSession } from "next-auth/react"

describe("CompleteAccountModal Component — Onboarding Verification", () => {
  const mockUpdateSession = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          id: "usr_123",
          name: "Dunsin Oyekan",
          email: "dunsin@example.com",
          username: null,
          onboardingCompleted: false,
          onboardingSkipped: false,
        },
      },
      status: "authenticated",
      update: mockUpdateSession,
    })
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it("opens modal and allows stepping through identity and contacts", async () => {
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/profile") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            name: "Dunsin Oyekan",
            email: "dunsin@example.com",
            username: null,
            organizationName: null,
          }),
        })
      }
      if (url.includes("/api/users/check-username")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ available: true }),
        })
      }
      if (url === "/api/profile" || url === "/api/user/onboarding") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<CompleteAccountModal />)

    await waitFor(() => {
      expect(screen.getByText("Complete Your Account")).toBeInTheDocument()
    })

    // Organization name and handle fields
    expect(screen.getByText(/Organization or Ministry Name/i)).toBeInTheDocument()
    expect(screen.getByText(/Organizer Vanity Handle/i)).toBeInTheDocument()

    // Step to Step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i })
    fireEvent.click(continueBtn)

    await waitFor(() => {
      expect(screen.getByText("Add Organization Contacts")).toBeInTheDocument()
    })

    expect(screen.getByText(/Main Office \/ Reception Phone/i)).toBeInTheDocument()
    expect(screen.getByText(/Office WhatsApp Line/i)).toBeInTheDocument()
    expect(screen.getByText(/Official Inquiry Email/i)).toBeInTheDocument()
  })

  it("allows user to skip onboarding cleanly", async () => {
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/profile") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            name: "Dunsin Oyekan",
            email: "dunsin@example.com",
            username: null,
          }),
        })
      }
      if (url === "/api/user/onboarding") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<CompleteAccountModal />)

    await waitFor(() => {
      expect(screen.getByText("Complete Your Account")).toBeInTheDocument()
    })

    const skipBtns = screen.getAllByRole("button", { name: /Skip for now/i })
    fireEvent.click(skipBtns[0])

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/user/onboarding", expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "skip" }),
      }))
      expect(mockUpdateSession).toHaveBeenCalledWith({ onboardingSkipped: true })
    })
  })
})
