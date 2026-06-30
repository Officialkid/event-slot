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

export type OrganizerPaymentRegistrationRow = {
  id: string
  registrationNumber: number | null
  attendeeName: string
  attendeeEmail: string | null
  submittedAt: string
  status: string
  waitlistPosition: number | null
  confirmationCode: string | null
  tierName: string
  amountPaid: number
  paymentStatus: "SUCCESS" | "PENDING" | "FAILED" | "WAITLIST"
  paymentReference: string | null
}

export type OrganizerPaymentAttemptRow = {
  id: string
  attendeeName: string
  attendeeEmail: string | null
  amount: number
  currency: SupportedCurrency
  status: string
  createdAt: string
  paidAt: string | null
  paymentMethod: string
  reference: string | null
}

export type OrganizerPaymentEventRow = {
  id: string
  slug: string
  title: string
  eventDate: string | null
  eventEndAt: string | null
  currency: SupportedCurrency
  gross: number
  commission: number
  net: number
  commissionRate: number
  status: "ACTIVE" | "ENDED" | "PAID_OUT"
  confirmedCount: number
  waitlistCount: number
  totalOrders: number
  successfulPayments: number
  pendingPayments: number
  failedPayments: number
  tiers: OrganizerPaymentTierBreakdown[]
  registrations: OrganizerPaymentRegistrationRow[]
  paymentAttempts: OrganizerPaymentAttemptRow[]
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

export type OrganizerPaymentsSecurityState = {
  email: string | null
  twoFactorEnabled: boolean
  paymentPinEnabled: boolean
}

export type OrganizerPaymentsDashboardData = {
  sidebar: OrganizerPaymentsSidebarSummary
  availableCurrencies: SupportedCurrency[]
  defaultCurrency: SupportedCurrency
  summaryByCurrency: Record<SupportedCurrency, OrganizerPaymentsCurrencySummary>
  events: OrganizerPaymentEventRow[]
  transactions: OrganizerPaymentTransactionRow[]
  withdrawals: OrganizerWithdrawalRow[]
  security: OrganizerPaymentsSecurityState
}

type OrganizerBalanceSnapshot = {
  grossKES: number
  commissionKES: number
  netKES: number
  withdrawnKES: number
  grossUSD: number
  commissionUSD: number
  netUSD: number
  withdrawnUSD: number
}

function normalizeCurrency(value: string | null | undefined): SupportedCurrency {
  return (value ?? "").trim().toUpperCase() === "USD" ? "USD" : "KES"
}

function emptyBalanceSnapshot(): OrganizerBalanceSnapshot {
  return {
    grossKES: 0,
    commissionKES: 0,
    netKES: 0,
    withdrawnKES: 0,
    grossUSD: 0,
    commissionUSD: 0,
    netUSD: 0,
    withdrawnUSD: 0,
  }
}

function getBalanceSummaries(balance: OrganizerBalanceSnapshot | null): Record<SupportedCurrency, OrganizerPaymentsCurrencySummary> {
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

function fallbackAttendeeName(input: { attendeeName?: string | null; attendeeEmail?: string | null; registrationNumber?: number | null }) {
  if (input.attendeeName?.trim()) return input.attendeeName.trim()
  if (input.attendeeEmail?.trim()) return input.attendeeEmail.trim()
  if (input.registrationNumber) return `Registrant #${input.registrationNumber}`
  return "Attendee"
}

async function buildOrganizerBalanceSnapshot(userId: string): Promise<OrganizerBalanceSnapshot> {
  const [payments, withdrawals] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: "SUCCESS",
        event: {
          organizerId: userId,
          isPaid: true,
        },
      },
      select: {
        amount: true,
        commissionAmount: true,
        organizerAmount: true,
        event: {
          select: {
            currency: true,
          },
        },
        paidEventOrder: {
          select: {
            currency: true,
          },
        },
      },
    }),
    prisma.withdrawal.findMany({
      where: { organiserId: userId },
      select: {
        amount: true,
        currency: true,
      },
    }),
  ])

  const snapshot = emptyBalanceSnapshot()

  for (const payment of payments) {
    const currency = normalizeCurrency(payment.paidEventOrder?.currency || payment.event.currency)
    if (currency === "USD") {
      snapshot.grossUSD += payment.amount
      snapshot.commissionUSD += payment.commissionAmount
      snapshot.netUSD += payment.organizerAmount
    } else {
      snapshot.grossKES += payment.amount
      snapshot.commissionKES += payment.commissionAmount
      snapshot.netKES += payment.organizerAmount
    }
  }

  for (const withdrawal of withdrawals) {
    const currency = normalizeCurrency(withdrawal.currency)
    if (currency === "USD") snapshot.withdrawnUSD += withdrawal.amount
    else snapshot.withdrawnKES += withdrawal.amount
  }

  return snapshot
}

async function ensureOrganizerBalanceSnapshot(userId: string): Promise<OrganizerBalanceSnapshot> {
  const snapshot = await buildOrganizerBalanceSnapshot(userId)
  const hasAnyValues = Object.values(snapshot).some((value) => value > 0)
  if (!hasAnyValues) return snapshot

  await prisma.organiserBalance.upsert({
    where: { organiserId: userId },
    create: {
      organiserId: userId,
      ...snapshot,
    },
    update: snapshot,
  })

  return snapshot
}

export async function getOrganizerPaymentsDashboardData(userId: string): Promise<OrganizerPaymentsDashboardData> {
  const [user, storedBalance, payments, withdrawals, paidEvents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        twoFactorEnabled: true,
        paymentPinEnabled: true,
      },
    }),
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
            id: true,
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
    prisma.event.findMany({
      where: {
        organizerId: userId,
        isPaid: true,
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        eventDate: true,
        eventEndAt: true,
        currency: true,
        confirmedCount: true,
        waitlistCount: true,
        ticketTiers: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            badgeColor: true,
            textColor: true,
            metallic: true,
            priceKes: true,
          },
        },
        registrations: {
          orderBy: [{ submittedAt: "desc" }],
          select: {
            id: true,
            registrationNumber: true,
            attendeeEmail: true,
            status: true,
            waitlistPosition: true,
            confirmationCode: true,
            submittedAt: true,
            ticketTier: {
              select: {
                name: true,
              },
            },
            paidOrder: {
              select: {
                attendeeName: true,
                attendeeEmail: true,
                amountKes: true,
                status: true,
                mpesaReceiptNumber: true,
              },
            },
            ticket: {
              select: {
                amountPaidKes: true,
              },
            },
          },
        },
        paidOrders: {
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            attendeeName: true,
            attendeeEmail: true,
            amountKes: true,
            currency: true,
            status: true,
            paymentMethod: true,
            providerReference: true,
            mpesaReceiptNumber: true,
            createdAt: true,
            paidAt: true,
          },
        },
      },
    }),
  ])

  const needsBalanceBackfill = !storedBalance && (payments.length > 0 || withdrawals.length > 0)
  const balance = needsBalanceBackfill ? await ensureOrganizerBalanceSnapshot(userId) : storedBalance
  const summaryByCurrency = getBalanceSummaries(balance)

  const transactions: OrganizerPaymentTransactionRow[] = payments.map((payment) => {
    const currency = normalizeCurrency(payment.paidEventOrder?.currency || payment.event.currency)
    return {
      id: payment.id,
      paidAt: (payment.paidAt ?? payment.createdAt).toISOString(),
      attendeeName: fallbackAttendeeName({
        attendeeName: payment.paidEventOrder?.attendeeName,
        attendeeEmail: payment.paidEventOrder?.attendeeEmail,
      }),
      attendeeEmail: payment.paidEventOrder?.attendeeEmail ?? null,
      eventTitle: payment.event.title,
      eventSlug: payment.event.slug,
      tierName: payment.ticketTier?.name ?? "General",
      currency,
      amount: payment.amount,
      commission: payment.commissionAmount,
      net: payment.organizerAmount,
      mpesaRef: payment.mpesaRef,
      method: payment.method,
    }
  })

  const paymentMapByEvent = new Map<string, typeof payments>()
  for (const payment of payments) {
    const existing = paymentMapByEvent.get(payment.event.id) ?? []
    existing.push(payment)
    paymentMapByEvent.set(payment.event.id, existing)
  }

  const payoutTracker: Record<SupportedCurrency, number> = {
    KES: summaryByCurrency.KES.withdrawn,
    USD: summaryByCurrency.USD.withdrawn,
  }

  const events = paidEvents.map((event) => {
    const eventCurrency = normalizeCurrency(event.currency)
    const successfulPayments = paymentMapByEvent.get(event.id) ?? []
    const tierMap = new Map<string, OrganizerPaymentTierBreakdown>()

    for (const tier of event.ticketTiers) {
      tierMap.set(tier.id, {
        id: tier.id,
        name: tier.name,
        badgeColor: tier.badgeColor,
        textColor: tier.textColor,
        metallic: tier.metallic,
        ticketsSold: 0,
        price: tier.priceKes,
        gross: 0,
        commission: 0,
        net: 0,
      })
    }

    let gross = 0
    let commission = 0
    let net = 0
    let commissionRate = 0

    for (const payment of successfulPayments) {
      gross += payment.amount
      commission += payment.commissionAmount
      net += payment.organizerAmount
      commissionRate = payment.commissionRate

      const tierId = payment.ticketTier?.id ?? `${event.id}-general`
      const existingTier =
        tierMap.get(tierId) ??
        {
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

      existingTier.ticketsSold += 1
      existingTier.gross += payment.amount
      existingTier.commission += payment.commissionAmount
      existingTier.net += payment.organizerAmount
      tierMap.set(tierId, existingTier)
    }

    const remainingPaidOut = payoutTracker[eventCurrency]
    payoutTracker[eventCurrency] = Math.max(remainingPaidOut - net, 0)

    const paymentAttempts: OrganizerPaymentAttemptRow[] = event.paidOrders.map((order) => ({
      id: order.id,
      attendeeName: fallbackAttendeeName({ attendeeName: order.attendeeName, attendeeEmail: order.attendeeEmail }),
      attendeeEmail: order.attendeeEmail ?? null,
      amount: order.amountKes,
      currency: normalizeCurrency(order.currency),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      paymentMethod: order.paymentMethod,
      reference: order.mpesaReceiptNumber ?? order.providerReference ?? null,
    }))

    const registrations: OrganizerPaymentRegistrationRow[] = event.registrations.map((registration) => {
      const paymentStatus =
        registration.status.startsWith("waitlist")
          ? "WAITLIST"
          : registration.paidOrder?.status === "PAID"
            ? "SUCCESS"
            : registration.paidOrder?.status === "PAYMENT_PENDING" || registration.paidOrder?.status === "PENDING"
              ? "PENDING"
              : registration.paidOrder?.status === "FAILED" || registration.paidOrder?.status === "EXPIRED" || registration.paidOrder?.status === "CANCELLED"
                ? "FAILED"
                : "WAITLIST"

      return {
        id: registration.id,
        registrationNumber: registration.registrationNumber,
        attendeeName: fallbackAttendeeName({
          attendeeName: registration.paidOrder?.attendeeName,
          attendeeEmail: registration.attendeeEmail ?? registration.paidOrder?.attendeeEmail,
          registrationNumber: registration.registrationNumber,
        }),
        attendeeEmail: registration.attendeeEmail ?? registration.paidOrder?.attendeeEmail ?? null,
        submittedAt: registration.submittedAt.toISOString(),
        status: registration.status,
        waitlistPosition: registration.waitlistPosition,
        confirmationCode: registration.confirmationCode,
        tierName: registration.ticketTier?.name ?? "General",
        amountPaid: registration.ticket?.amountPaidKes ?? registration.paidOrder?.amountKes ?? 0,
        paymentStatus,
        paymentReference: registration.paidOrder?.mpesaReceiptNumber ?? null,
      }
    })

    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      eventDate: event.eventDate?.toISOString() ?? null,
      eventEndAt: event.eventEndAt?.toISOString() ?? null,
      currency: eventCurrency,
      gross,
      commission,
      net,
      commissionRate,
      status: getEventStatus(event.eventDate, event.eventEndAt, net, remainingPaidOut),
      confirmedCount: event.confirmedCount,
      waitlistCount: event.waitlistCount,
      totalOrders: event.paidOrders.length,
      successfulPayments: event.paidOrders.filter((order) => order.status === "PAID").length,
      pendingPayments: event.paidOrders.filter((order) => order.status === "PENDING" || order.status === "PAYMENT_PENDING").length,
      failedPayments: event.paidOrders.filter((order) => order.status === "FAILED" || order.status === "EXPIRED" || order.status === "CANCELLED").length,
      tiers: Array.from(tierMap.values()).sort((a, b) => b.net - a.net || a.name.localeCompare(b.name)),
      registrations,
      paymentAttempts,
    }
  })

  const availableCurrencies = (["KES", "USD"] as const).filter((currency) => {
    const hasSummaryActivity = summaryByCurrency[currency].gross > 0 || summaryByCurrency[currency].withdrawn > 0
    const hasEventActivity = events.some((event) => event.currency === currency)
    return hasSummaryActivity || hasEventActivity
  })

  const sidebar = {
    visible: true,
    hasWithdrawableBalance: (["KES", "USD"] as const).some((currency) => summaryByCurrency[currency].withdrawable > 0),
    badgeCount: (["KES", "USD"] as const).reduce(
      (count, currency) => count + (summaryByCurrency[currency].withdrawable > 0 ? 1 : 0),
      0
    ),
  }

  return {
    sidebar,
    availableCurrencies: availableCurrencies.length > 0 ? availableCurrencies : ["KES"],
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
    security: {
      email: user?.email ?? null,
      twoFactorEnabled: Boolean(user?.twoFactorEnabled),
      paymentPinEnabled: Boolean(user?.paymentPinEnabled),
    },
  }
}

export async function getOrganizerPaymentsSidebarSummary(userId: string): Promise<OrganizerPaymentsSidebarSummary> {
  const [balance] = await Promise.all([
    prisma.organiserBalance.findUnique({
      where: { organiserId: userId },
      select: {
        netKES: true,
        withdrawnKES: true,
        netUSD: true,
        withdrawnUSD: true,
      },
    }),
  ])

  const withdrawableKes = Math.max((balance?.netKES ?? 0) - (balance?.withdrawnKES ?? 0), 0)
  const withdrawableUsd = Math.max((balance?.netUSD ?? 0) - (balance?.withdrawnUSD ?? 0), 0)
  const badgeCount = Number(withdrawableKes > 0) + Number(withdrawableUsd > 0)

  return {
    visible: true,
    hasWithdrawableBalance: badgeCount > 0,
    badgeCount,
  }
}

export async function getOrganizerWithdrawableBalance(userId: string, currency: SupportedCurrency) {
  const storedBalance = await prisma.organiserBalance.findUnique({
    where: { organiserId: userId },
    select: {
      netKES: true,
      withdrawnKES: true,
      netUSD: true,
      withdrawnUSD: true,
    },
  })

  const balance = storedBalance ?? ((await ensureOrganizerBalanceSnapshot(userId)) satisfies OrganizerBalanceSnapshot)

  if (currency === "USD") {
    return Math.max((balance?.netUSD ?? 0) - (balance?.withdrawnUSD ?? 0), 0)
  }
  return Math.max((balance?.netKES ?? 0) - (balance?.withdrawnKES ?? 0), 0)
}
