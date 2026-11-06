/** @jest-environment jsdom */

import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { EventDraftPreviewCard } from "@/components/assistant/EventDraftPreviewCard"
import type { EventDraftPreview } from "@/lib/assistant/draft-preparation"

describe("EventDraftPreviewCard — Frontend Preview Experience", () => {
  const samplePreview: EventDraftPreview = {
    draftId: "draft_test_123",
    draftVersion: "dv_abc1234567890123",
    status: "HAS_CONTRADICTIONS",
    isLiveEvent: false,
    statusBanner:
      "Draft preview only — no live event has been created or published on EventSlot.",
    fields: {
      title: "Nairobi Developer Meetup",
      description: "Monthly gathering of East African software engineers.",
      category: "NETWORKING",
      visibility: "PRIVATE",
      accessType: "REGISTRATION",
      eventType: "PHYSICAL",
      eventDate: null,
      eventEndAt: null,
      deadline: null,
      location: "iHub, Senteu Plaza",
      virtualLink: null,
      capacity: 120,
      isPaid: true,
      ticketPrice: null,
      currency: "KSh",
      organizerName: "DevCraft Kenya",
      whatsappNumber: null,
      entryFeeLabel: null,
    },
    fieldProvenance: {
      title: "poster_vision",
      description: "user_text",
      organizerName: "schema_default",
      eventType: "schema_default",
      accessType: "schema_default",
      location: "poster_vision",
      virtualLink: "schema_default",
      eventDate: "schema_default",
      eventEndAt: "schema_default",
      deadline: "schema_default",
      capacity: "user_text",
      isPaid: "user_text",
      ticketPrice: "schema_default",
      visibility: "schema_default",
      currency: "schema_default",
    },
    extractedFieldKeys: ["title", "description", "location", "capacity", "isPaid"],
    inferredFieldKeys: [
      "organizerName",
      "eventType",
      "accessType",
      "visibility",
      "currency",
    ],
    missingFields: [
      {
        field: "eventDate",
        label: "Event Date & Time",
        reason: "Required so attendees know when the event starts.",
      },
      {
        field: "ticketPrice",
        label: "Ticket Price (KES)",
        reason: "Paid events require a ticket price between KSh 50 and KSh 500,000.",
      },
    ],
    uncertainFields: [
      {
        field: "ticketPrice",
        label: "Paid vs. Free Pricing",
        issue: "Poster mentions both VIP passes and free entry.",
      },
    ],
    validationIssues: [
      {
        path: "ticketTiers",
        message: "Paid events must have at least one ticket tier.",
      },
    ],
    schemaValid: false,
    nextRecommendedStep:
      "Reply with the missing details (Event Date & Time, Ticket Price (KES)) or clarify the highlighted fields to refine your draft preview.",
    updatedAt: "2026-10-27T12:00:00.000Z",
  }

  it("renders extracted fields, provenance badges, missing fields, uncertain fields, validation warnings, and the non-published status banner", () => {
    const onSuggestCorrection = jest.fn()

    render(
      <EventDraftPreviewCard
        preview={samplePreview}
        onSuggestCorrection={onSuggestCorrection}
      />
    )

    // Non-published status banner & badge
    expect(screen.getByTestId("draft-preview-badge").textContent).toContain(
      "Preview Only · Not Published"
    )
    expect(screen.getByTestId("draft-status-banner").textContent).toContain(
      "Draft preview only — no live event has been created or published on EventSlot."
    )
    expect(screen.getByTestId("draft-version-badge").textContent).toContain(
      "dv_abc1234567890123"
    )

    // Extracted & default fields rendered
    expect(screen.getByText("Nairobi Developer Meetup")).toBeTruthy()
    expect(screen.getByText("DevCraft Kenya")).toBeTruthy()
    expect(screen.getByText("iHub, Senteu Plaza")).toBeTruthy()
    expect(screen.getByText("120 attendees")).toBeTruthy()
    expect(screen.getAllByText("Poster").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Default").length).toBeGreaterThanOrEqual(1)

    // Missing fields rendered
    const missingBox = screen.getByTestId("draft-missing-fields")
    expect(missingBox.textContent).toContain("Event Date & Time")
    expect(missingBox.textContent).toContain("Ticket Price (KES)")

    // Uncertain / contradictory fields rendered
    const uncertainBox = screen.getByTestId("draft-uncertain-fields")
    expect(uncertainBox.textContent).toContain("Paid vs. Free Pricing")
    expect(uncertainBox.textContent).toContain(
      "Poster mentions both VIP passes and free entry."
    )

    // Validation issues rendered
    const validationBox = screen.getByTestId("draft-validation-issues")
    expect(validationBox.textContent).toContain(
      "Paid events must have at least one ticket tier."
    )

    // Quick correction helper button triggers callback and does NOT publish
    const setDateBtn = screen.getByRole("button", {
      name: /\+ Set Event Date & Time/i,
    })
    fireEvent.click(setDateBtn)
    expect(onSuggestCorrection).toHaveBeenCalledWith(
      "Update the draft event date & time to: "
    )

    // Verify there is NO live publish button
    expect(screen.queryByRole("button", { name: /^publish/i })).toBeNull()
  })

  it("renders confirmation & cancellation buttons when durable proposal is ready", () => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()

    const readyPreview = {
      ...samplePreview,
      schemaValid: true,
      missingFields: [],
      uncertainFields: [],
      validationIssues: [],
    }

    render(
      <EventDraftPreviewCard
        preview={readyPreview}
        proposalId="prop_test_456"
        idempotencyKey="idem_test_456"
        onConfirmCreation={onConfirm}
        onCancelProposal={onCancel}
      />
    )

    const confirmBtn = screen.getByTestId("confirm-event-creation-btn")
    expect(confirmBtn.textContent).toBe("Confirm & Create Event")
    expect(confirmBtn).not.toBeDisabled()

    const cancelBtn = screen.getByTestId("cancel-event-proposal-btn")
    expect(cancelBtn.textContent).toBe("Cancel")

    fireEvent.click(confirmBtn)
    expect(onConfirm).toHaveBeenCalledWith("prop_test_456", "idem_test_456")

    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalledWith("prop_test_456")
  })

  it("renders verified live created event banner with dashboard link when creation succeeded", () => {
    render(
      <EventDraftPreviewCard
        preview={samplePreview}
        confirmedEventResult={{
          id: "evt_created_789",
          title: "Nairobi Developer Meetup",
          slug: "nairobi-developer-meetup-ab12",
        }}
      />
    )

    const banner = screen.getByTestId("confirmed-event-banner")
    expect(banner.textContent).toContain("Event Created Live")
    expect(banner.textContent).toContain("Nairobi Developer Meetup")

    const link = screen.getByRole("link", { name: /Manage in Dashboard/i })
    expect(link.getAttribute("href")).toBe("/dashboard/events/nairobi-developer-meetup-ab12")
  })

  it("renders side effects warning notice on confirmed banner when notifications are delayed", () => {
    render(
      <EventDraftPreviewCard
        preview={samplePreview}
        confirmedEventResult={{
          id: "evt_created_789",
          title: "Nairobi Developer Meetup",
          slug: "nairobi-developer-meetup-ab12",
          sideEffectsDeliveryStatus: "PARTIALLY_DISPATCHED",
        }}
      />
    )

    expect(screen.getByTestId("side-effects-warning").textContent).toContain(
      "Some background notifications could not be immediately delivered"
    )
  })

  it("renders cancelled banner when proposalStatus is CANCELLED", () => {
    render(
      <EventDraftPreviewCard
        preview={samplePreview}
        proposalStatus="CANCELLED"
      />
    )

    expect(screen.getByTestId("proposal-cancelled-banner").textContent).toContain(
      "This event creation proposal was cancelled"
    )
  })

  it("renders expired banner when proposalStatus is EXPIRED", () => {
    render(
      <EventDraftPreviewCard
        preview={samplePreview}
        proposalStatus="EXPIRED"
      />
    )

    expect(screen.getByTestId("proposal-expired-banner").textContent).toContain(
      "This confirmation proposal has expired"
    )
  })

  it("renders failure banner when proposalStatus is FAILED", () => {
    render(
      <EventDraftPreviewCard
        preview={samplePreview}
        proposalStatus="FAILED"
      />
    )

    expect(screen.getByTestId("proposal-failed-banner").textContent).toContain(
      "Event creation failed"
    )
  })

  it("disables confirm button and shows 'Creating Event...' when isConfirming is true", () => {
    const readyPreview = {
      ...samplePreview,
      schemaValid: true,
      missingFields: [],
      uncertainFields: [],
      validationIssues: [],
    }

    render(
      <EventDraftPreviewCard
        preview={readyPreview}
        proposalId="prop_test_456"
        idempotencyKey="idem_test_456"
        onConfirmCreation={jest.fn()}
        isConfirming={true}
      />
    )

    const confirmBtn = screen.getByTestId("confirm-event-creation-btn")
    expect(confirmBtn.textContent).toBe("Creating Event...")
    expect(confirmBtn).toBeDisabled()
  })
})
