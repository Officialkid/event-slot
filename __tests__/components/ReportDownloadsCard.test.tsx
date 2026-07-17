import { render, screen } from "@testing-library/react"
import { ReportDownloadsCard } from "@/components/billing/ReportDownloadsCard"

describe("ReportDownloadsCard", () => {
  it("hides paid bundles while billing checkout is paused", () => {
    render(
      <ReportDownloadsCard
        initialRemaining={0}
        initialTotalPurchased={0}
        bundles={[
          { key: "single", amount: 100, downloads: 1, label: "Single download" },
          { key: "bundle3", amount: 285, downloads: 3, label: "3 downloads" },
        ]}
      />,
    )

    expect(screen.getByText("Report downloads are free right now")).toBeInTheDocument()
    expect(screen.getByText(/full Word downloads are available/i)).toBeInTheDocument()
    expect(screen.queryByText(/KSh/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /buy this bundle/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/paid download slot/i)).not.toBeInTheDocument()
  })
})
