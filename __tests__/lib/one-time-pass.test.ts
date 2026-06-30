import {
  getEventPassExpiryDate,
  getOneTimePassQuote,
  getOneTimePassTiers,
  normalizeOneTimePassTier,
} from "@/lib/oneTimePassCatalog"

describe("one-time event pass catalog", () => {
  it("prices each pass at one quarter of the monthly subscription price", () => {
    expect(getOneTimePassQuote("standard").priceUsd).toBe(2.25)
    expect(getOneTimePassQuote("pro").priceUsd).toBe(6.25)
    expect(getOneTimePassQuote("business").priceUsd).toBe(17.25)
  })

  it("keeps the pass catalog limited to standard, pro, and business", () => {
    expect(getOneTimePassTiers().map((entry) => entry.tier)).toEqual([
      "standard",
      "pro",
      "business",
    ])
  })

  it("normalizes supported tiers and rejects invalid values", () => {
    expect(normalizeOneTimePassTier("PRO")).toBe("pro")
    expect(normalizeOneTimePassTier(" business ")).toBe("business")
    expect(normalizeOneTimePassTier("free")).toBeNull()
  })
})

describe("event pass expiry", () => {
  it("uses event end time when present", () => {
    const eventDate = new Date("2026-07-20T09:00:00.000Z")
    const eventEndAt = new Date("2026-07-20T18:00:00.000Z")

    expect(getEventPassExpiryDate(eventDate, eventEndAt)?.toISOString()).toBe(
      "2026-07-20T18:00:00.000Z"
    )
  })

  it("falls back to event start date when no end time is set", () => {
    const eventDate = new Date("2026-07-20T09:00:00.000Z")

    expect(getEventPassExpiryDate(eventDate, null)?.toISOString()).toBe(
      "2026-07-20T09:00:00.000Z"
    )
  })
})
