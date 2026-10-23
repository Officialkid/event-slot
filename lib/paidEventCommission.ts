export const FLAT_PAID_EVENT_COMMISSION_RATE = 0.05

export const COMMISSION_RATES: Record<string, number> = {
  free: FLAT_PAID_EVENT_COMMISSION_RATE,
  standard: FLAT_PAID_EVENT_COMMISSION_RATE,
  pro: FLAT_PAID_EVENT_COMMISSION_RATE,
  business: FLAT_PAID_EVENT_COMMISSION_RATE,
}

export function getPaidEventCommissionRate(_plan?: string | null | undefined): number {
  return FLAT_PAID_EVENT_COMMISSION_RATE
}

export function calculatePaidEventCommission(
  amountKes: number,
  _plan?: string | null | undefined
) {
  const commissionRate = FLAT_PAID_EVENT_COMMISSION_RATE

  if (!Number.isFinite(amountKes) || amountKes <= 0) {
    return {
      commissionRate,
      commissionAmount: 0,
      organizerAmount: 0,
    }
  }

  const commissionAmount = Math.round(amountKes * commissionRate)
  const organizerAmount = amountKes - commissionAmount

  return {
    commissionRate,
    commissionAmount,
    organizerAmount,
  }
}
