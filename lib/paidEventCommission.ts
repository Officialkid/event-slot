const COMMISSION_RATES: Record<string, number> = {
  free: 0.10,
  standard: 0.08,
  pro: 0.05,
  business: 0.03,
}

export function getPaidEventCommissionRate(plan: string | null | undefined): number {
  const key = (plan ?? 'free').trim().toLowerCase()
  return COMMISSION_RATES[key] ?? COMMISSION_RATES.free
}

export function calculatePaidEventCommission(amountKes: number, plan: string | null | undefined) {
  const commissionRate = getPaidEventCommissionRate(plan)
  const commissionAmount = Math.round(amountKes * commissionRate)
  const organizerAmount = amountKes - commissionAmount

  return {
    commissionRate,
    commissionAmount,
    organizerAmount,
  }
}
