/** @jest-environment jsdom */

import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { OrganizedByCard } from "@/components/events/OrganizedByCard"
import { useSession } from "next-auth/react"

describe("OrganizedByCard Component — UI Verification", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    })
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it("renders organizer initials when profile image is null", () => {
    render(
      <OrganizedByCard
        organizerName="Dunsin Oyekan Ministries"
        organizerUsername="dunsinoyekan"
        followerCount={14119}
        hostedEventsCount={21}
      />
    )

    expect(screen.getByText("Organized by")).toBeInTheDocument()
    expect(screen.getByText("Dunsin Oyekan Ministries")).toBeInTheDocument()
    expect(screen.getByText("DO")).toBeInTheDocument()
    expect(screen.getByText("14,119")).toBeInTheDocument()
    expect(screen.getByText("21")).toBeInTheDocument()
  })

  it("renders profile image when provided", () => {
    render(
      <OrganizedByCard
        organizerName="Dunsin Oyekan Ministries"
        organizerUsername="dunsinoyekan"
        organizerImage="https://example.com/dunsin.jpg"
        followerCount={500}
        hostedEventsCount={5}
      />
    )

    const img = screen.getByRole("img", { name: "Dunsin Oyekan Ministries" })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute("src", "https://example.com/dunsin.jpg")
  })

  it("hides the Contact button when no office contact info is provided", () => {
    render(
      <OrganizedByCard
        organizerName="Dunsin Oyekan Ministries"
        organizerUsername="dunsinoyekan"
        contactPhone={null}
        contactWhatsapp={null}
        contactEmail={null}
      />
    )

    expect(screen.queryByRole("button", { name: /Contact/i })).not.toBeInTheDocument()
  })

  it("shows the Contact button when office contact channels exist and opens contact modal", () => {
    render(
      <OrganizedByCard
        organizerName="Dunsin Oyekan Ministries"
        organizerUsername="dunsinoyekan"
        contactPhone="+254712345678"
        contactWhatsapp="+254712345678"
        contactEmail="office@dunsin.org"
      />
    )

    const contactBtn = screen.getByRole("button", { name: /Contact/i })
    expect(contactBtn).toBeInTheDocument()

    // Open modal
    fireEvent.click(contactBtn)

    expect(screen.getByText("Contact Dunsin Oyekan Ministries")).toBeInTheDocument()
    expect(screen.getByText("WhatsApp")).toBeInTheDocument()
    expect(screen.getByText("Office Line")).toBeInTheDocument()
    expect(screen.getByText("Inquiry Email")).toBeInTheDocument()
    expect(screen.getByText("office@dunsin.org")).toBeInTheDocument()
  })
})
