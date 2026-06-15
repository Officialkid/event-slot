export type TicketTierInput = {
  name: string
  priceKes: number
  capacity: number
  description?: string | null
  bundleSize?: number | null
}

export type TicketTierSummary = TicketTierInput & {
  id: string
  soldCount: number
  waitlistCount: number
  sortOrder: number
  status?: string
}

export function normalizeTierName(value: string | null | undefined): string {
  return (value ?? "").trim()
}

export function normalizeTicketTiers(
  tiers: TicketTierInput[] | null | undefined,
  fallback: { ticketPrice?: number | null; capacity?: number | null }
): TicketTierInput[] {
  const normalized = (tiers ?? [])
    .map((tier) => ({
      name: normalizeTierName(tier.name),
      priceKes: Number(tier.priceKes),
      capacity: Number(tier.capacity),
      description: tier.description?.trim() || null,
      bundleSize: tier.bundleSize ? Number(tier.bundleSize) : 1,
    }))
    .filter((tier) => tier.name)

  if (normalized.length > 0) {
    return normalized
  }

  if (fallback.ticketPrice && fallback.capacity) {
    return [
      {
        name: "Standard",
        priceKes: Number(fallback.ticketPrice),
        capacity: Number(fallback.capacity),
        description: null,
        bundleSize: 1,
      },
    ]
  }

  return []
}

export function sumTierCapacity(tiers: Array<{ capacity: number }>): number {
  return tiers.reduce((sum, tier) => sum + Number(tier.capacity || 0), 0)
}

export function getTierAvailability(params: {
  capacity: number
  soldCount: number
  pendingCount?: number
}): number {
  const pendingCount = params.pendingCount ?? 0
  return Math.max(0, params.capacity - params.soldCount - pendingCount)
}

export function parseAttendeeIdentity(
  answers: Array<{ questionId: string; value: string }>,
  questions: Array<{ id: string; type: string; label: string }>
) {
  const findField = (types: string[], hints: string[]) => {
    for (const type of types) {
      const q = questions.find((item) => item.type === type)
      if (q) {
        const found = answers.find((answer) => answer.questionId === q.id)?.value?.trim()
        if (found) return found
      }
    }
    for (const hint of hints) {
      const q = questions.find((item) => item.label.toLowerCase().includes(hint))
      if (q) {
        const found = answers.find((answer) => answer.questionId === q.id)?.value?.trim()
        if (found) return found
      }
    }
    return null
  }

  return {
    attendeeName: findField(["text"], ["name"]),
    attendeeEmail: findField(["email"], ["email"]),
    attendeePhone: findField(["phone", "tel"], ["phone", "mobile"]),
  }
}
