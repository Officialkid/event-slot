jest.mock("@/lib/ai", () => ({
  askAI: jest.fn(async () => null),
}))

import { MONTHLY_SECTION_ORDER, YEARLY_SECTION_ORDER } from "@/lib/generateStakeholderReport"

describe("stakeholder report section order", () => {
  it("matches monthly section order snapshot", () => {
    expect(MONTHLY_SECTION_ORDER).toMatchInlineSnapshot(`
[
  "Cover Page",
  "Executive Summary",
  "Platform Growth",
  "Plan Mix & Monetisation Pipeline",
  "Event Activity",
  "System Health",
  "AI Strategic Recommendations",
  "Next Period Targets",
  "Footer",
]
`)
  })

  it("matches yearly section order snapshot", () => {
    expect(YEARLY_SECTION_ORDER).toMatchInlineSnapshot(`
[
  "Cover Page",
  "Year in Review",
  "Executive Summary",
  "Platform Growth",
  "Top Events of the Year",
  "Plan Mix & Monetisation Pipeline",
  "System Health Summary",
  "AI Strategic Recommendations",
  "Year-Ahead Outlook",
  "Footer",
]
`)
  })
})
