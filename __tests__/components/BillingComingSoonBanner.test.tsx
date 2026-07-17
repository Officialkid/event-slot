import { render, screen } from "@testing-library/react"
import { BillingComingSoonBanner } from "@/components/billing/BillingComingSoonBanner"

describe("BillingComingSoonBanner", () => {
  it("keeps the billing page informational while payments are paused", () => {
    render(<BillingComingSoonBanner compact />)

    expect(screen.getByRole("region", { name: /payment system coming soon/i })).toBeInTheDocument()
    expect(screen.getByText("Payment system coming soon")).toBeInTheDocument()
    expect(screen.getByText(/payment collection, billing changes, paid-event checkout, and withdrawals are hidden/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /view free events/i })).toHaveAttribute("href", "/dashboard/events")
    expect(screen.getByRole("link", { name: /back to dashboard/i })).toHaveAttribute("href", "/dashboard")
    expect(screen.queryByRole("button", { name: /notify me/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/super admin accounts remain/i)).not.toBeInTheDocument()
  })
})
