import { WithdrawalMethod, WithdrawalStatus } from "@prisma/client"
import prisma from "@/lib/prisma"

export type SupportedCurrency = "KES" | "USD"

export type OrganizerPaymentsSidebarSummary = {
  visible: boolean
  hasWithdrawableBalance: boolean
  badgeCount: number
}

export type OrganizerPaymentsCurrencySummary = {
  currency: SupportedCurrency
  gross: number
  commission: number
  net: number
  withdrawn: number
  withdrawable: number
}

export type OrganizerPaymentTierBreakdown = {
  id: string
  name: string
  badgeColor: string
  textColor: string
  metallic: boolean
  ticketsSold: number
  price: number
  gross: number
  commission: number
  net: number
}

export type OrganizerPaymentEventRow = {
  id: string
  slug: string
  title: string
  eventDate: string | null
  currency: SupportedCurrency
  gross: number
  commission: number
  net: number
  commissionRate: number
  status: "ACTIVE" | "ENDED" | "PAID_OUT"
  tiers: OrganizerPaymentTierBreakdown[]
}

export type OrganizerPaymentTransactionRow = {
  id: string
  paidAt: string | null
  attendeeName: string
  attendeeEmail: string | null
  eventTitle: string
  eventSlug: string
  tierName: string
  currency: SupportedCurrency
  amount: number
  commission: number
  net: number
  mpesaRef: string | null
  method: string
}

export type OrganizerWithdrawalRow = {
  id: string
  createdAt: string
  amount: number
  currency: SupportedCurrency
  method: WithdrawalMethod
  status: WithdrawalStatus
  providerRef: string | null
  destination: string
}

export type OrganizerPaymentsDashboardData = {
  sidebar: OrganizerPaymentsSidebarSummary
  availableCurrencies: SupportedCurrency[]
  defaultCurrency: SupportedCurrency
  summaryByCurrency: Record<SupportedCurrency, OrganizerPaymentsCurrencySummary>
  events: OrganizerPaymentEventRow[]
  transactions: OrganizerPaymentTransactionRow[]
  withdrawals: OrganizerWithdrawalRow[]
}

function normalizeCurrency(value: string | null | undefined): SupportedCurrency {
  return (value ?? "").trim().toUpperCase() === "USD" ? "USD" : "KES"
}

function getBalanceSummaries(balance: {
  grossKES: number
  commissionKES: number
  netKES: number
  withdrawnKES: number
  grossUSD: number
  commissionUSD: number
  netUSD: number
  withdrawnUSD: number
} | null): Record<SupportedCurrency, OrganizerPaymentsCurrencySummary> {
  return {
    KES: {
      currency: "KES",
      gross: balance?.grossKES ?? 0,
      commission: balance?.commissionKES ?? 0,
      net: balance?.netKES ?? 0,
      withdrawn: balance?.withdrawnKES ?? 0,
      withdrawable: Math.max((balance?.netKES ?? 0) - (balance?.withdrawnKES ?? 0), 0),
    },
    USD: {
      currency: "USD",
      gross: balance?.grossUSD ?? 0,
      commission: balance?.commissionUSD ?? 0,
      net: balance?.netUSD ?? 0,
      withdrawn: balance?.withdrawnUSD ?? 0,
      withdrawable: Math.max((balance?.netUSD ?? 0) - (balance?.withdrawnUSD ?? 0), 0),
    },
  }
}

function getEventStatus(eventDate: Date | null, eventEndAt: Date | null, net: number, remainingPaidOut: number): "ACTIVE" | "ENDED" | "PAID_OUT" {
  if (remainingPaidOut >= net && net > 0) return "PAID_OUT"
  const boundary = eventEndAt ?? eventDate
  if (!boundary) return "ACTIVE"
  return boundary.getTime() < Date.now() ? "ENDED" : "ACTIVE"
}

export async function getOrganizerPaymentsDashboardData(userId: string): Promise<OrganizerPaymentsDashboardData> {
  const [balance, payments, withdrawals] = await Promise.all([
    prisma.organiserBalance.findUnique({
      where: { organiserId: userId },
      select: {
        grossKES: true,
        commissionKES: true,
        netKES: true,
        withdrawnKES: true,
        grossUSD: true,
        commissionUSD: true,
        netUSD: true,
        withdrawnUSD: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        status: "SUCCESS",
        event: {
          organizerId: userId,
          isPaid: true,
        },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        amount: true,
        commissionAmount: true,
        organizerAmount: true,
        commissionRate: true,
        method: true,
        mpesaRef: true,
        paidAt: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            eventDate: true,
            eventEndAt: true,
            currency: true,
          },
        },
        ticketTier: {
          select: {
            id: true,
            name: true,
            badgeColor: true,
            textColor: true,
            metallic: true,
            priceKes: true,
          },
        },
        paidEventOrder: {
          select: {
            attendeeName: true,
            attendeeEmail: true,
            currency: true,
          },
        },
      },
    }),
    prisma.withdrawal.findMany({
      where: { organiserId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        status: true,
        providerRef: true,
        destination: true,
        createdAt: true,
      },
    }),
  ])

  const summaryByCurrency = getBalanceSummaries(balance)
  const eventMap = new Map<string, OrganizerPaymentEventRow>()
  const payoutTracker: Record<SupportedCurrency, number> = {
    KES: summaryByCurrency.KES.withdrawn,
    USD: summaryByCurrency.USD.withdrawn,
  }

  const transactions: OrganizerPaymentTransactionRow[] = []

  for (const payment of payments) {
    const currency = normalizeCurrency(payment.paidEventOrder.currency || payment.event.currency)
    let event = eventMap.get(payment.event.id)
    if (!event) {
      event = {
        id: payment.event.id,
        slug: payment.event.slug,
        title: payment.event.title,
        eventDate: payment.event.eventDate?.toISOString() ?? null,
        currency,
        gross: 0,
        commission: 0,
        net: 0,
        commissionRate: payment.commissionRate,
        status: "ACTIVE",
        tiers: [],
      }
      eventMap.set(payment.event.id, event)
    }

    event.gross += payment.amount
    event.commission += payment.commissionAmount
    event.net += payment.organizerAmount
    event.commissionRate = payment.commissionRate

    const tierId = payment.ticketTier?.id ?? `${payment.event.id}-general`
    let tier = event.tiers.find((item) => item.id === tierId)
    if (!tier) {
      tier = {
        id: tierId,
        name: payment.ticketTier?.name ?? "General",
        badgeColor: payment.ticketTier?.badgeColor ?? "#A8A9AD",
        textColor: payment.ticketTier?.textColor ?? "#1A1A1A",
        metallic: payment.ticketTier?.metallic ?? false,
        ticketsSold: 0,
        price: payment.ticketTier?.priceKes ?? payment.amount,
        gross: 0,
        commission: 0,
        net: 0,
      }
      event.tiers.push(tier)
    }

    tier.ticketsSold += 1
    tier.gross += payment.amount
    tier.commission += payment.commissionAmount
    tier.net += payment.organizerAmount
    if (!payment.ticketTier?.priceKes && tier.ticketsSold > 0) {
      tier.price = Math.round(tier.gross / tier.ticketsSold)
    }

    transactions.push({
      id: payment.id,
      paidAt: (payment.paidAt ?? payment.createdAt).toISOString(),
      attendeeName: payment.paidEventOrder.attendeeName?.trim() || "Attendee",
      attendeeEmail: payment.paidEventOrder.attendeeEmail,
      eventTitle: payment.event.title,
      eventSlug: payment.event.slug,
      tierName: payment.ticketTier?.name ?? "General",
      currency,
      amount: payment.amount,
      commission: payment.commissionAmount,
      net: payment.organizerAmount,
      mpesaRef: payment.mpesaRef,
      method: payment.method,
    })
  }

  const events = Array.from(eventMap.values())
    .sort((a, b) => {
      const aDate = a.eventDate ? new Date(a.eventDate).getTime() : 0
      const bDate = b.eventDate ? new Date(b.eventDate).getTime() : 0
      return aDate - bDate
    })
    .map((event) => {
      const remainingPaidOut = payoutTracker[event.currency]
      const status = getEventStatus(
        event.eventDate ? new Date(event.eventDate) : null,
        null,
        event.net,
        remainingPaidOut
      )
      payoutTracker[event.currency] = Math.max(remainingPaidOut - event.net, 0)
      return { ...event, status }
    })
    .sort((a, b) => {
      const aDate = a.eventDate ? new Date(a.eventDate).getTime() : 0
      const bDate = b.eventDate ? new Date(b.eventDate).getTime() : 0
      return bDate - aDate
    })

  const availableCurrencies = (["KES", "USD"] as const).filter(
    (currency) => summaryByCurrency[currency].gross > 0 || summaryByCurrency[currency].withdrawn > 0
  )

  const sidebar = {
    visible: payments.length > 0,
    hasWithdrawableBalance: availableCurrencies.some((currency) => summaryByCurrency[currency].withdrawable > 0),
    badgeCount: availableCurrencies.reduce(
      (count, currency) => count + (summaryByCurrency[currency].withdrawable > 0 ? 1 : 0),
      0
    ),
  }

  return {
    sidebar,
    availableCurrencies,
    defaultCurrency: availableCurrencies[0] ?? "KES",
    summaryByCurrency,
    events,
    transactions,
    withdrawals: withdrawals.map((withdrawal) => ({
      id: withdrawal.id,
      createdAt: withdrawal.createdAt.toISOString(),
      amount: withdrawal.amount,
      currency: normalizeCurrency(withdrawal.currency),
      method: withdrawal.method,
      status: withdrawal.status,
      providerRef: withdrawal.providerRef,
      destination: withdrawal.destination,
    })),
  }
}

export async function getOrganizerPaymentsSidebarSummary(userId: string): Promise<OrganizerPaymentsSidebarSummary> {
  return (await getOrganizerPaymentsDashboardData(userId)).sidebar
}

export async function getOrganizerWithdrawableBalance(userId: string, currency: SupportedCurrency) {
  const balance = await prisma.organiserBalance.findUnique({
    where: { organiserId: userId },
    select: {
      netKES: true,
      withdrawnKES: true,
      netUSD: true,
      withdrawnUSD: true,
    },
  })

  if (currency === "USD") {
    return Math.max((balance?.netUSD ?? 0) - (balance?.withdrawnUSD ?? 0), 0)
  }
  return Math.max((balance?.netKES ?? 0) - (balance?.withdrawnKES ?? 0), 0)
}
