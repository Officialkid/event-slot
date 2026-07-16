import { fireEvent, render, screen } from "@testing-library/react"
import { EventPassSelector } from "@/components/billing/EventPassSelector"

describe("EventPassSelector", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "dark")
  })

  it("starts compact in a small summary state and expands on demand", () => {
    render(
      <EventPassSelector
        eventId="event-123"
        eventTitle="Volunteer Training"
        compact
      />,
    )

    expect(screen.getByText("Upgrade one event only")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /learn more/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /hide details/i })).not.toBeInTheDocument()
    expect(screen.queryByText("Standard Pass")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /continue/i }))

    expect(screen.getByRole("button", { name: /hide details/i })).toBeInTheDocument()
    expect(screen.getByText("Standard Pass")).toBeInTheDocument()
    expect(screen.getByText("Business Pass")).toBeInTheDocument()
    expect(screen.getByText(/continue using card/i)).toBeInTheDocument()
  })
})
