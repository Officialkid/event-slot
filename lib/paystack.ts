/** Make an authenticated request to the Paystack API */
export async function paystackFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  const raw = await res.text()
  try {
    return JSON.parse(raw)
  } catch {
    return {
      status: false,
      message: `Unexpected Paystack response (HTTP ${res.status})`,
      raw,
    }
  }
}

export function getPlanFromPlanCode(planCode: string): string {
  void planCode
  return 'free'
}

export function getBillingCycleFromPlanCode(planCode: string): string {
  const annualCodes = [
    process.env.PAYSTACK_PRO_ANNUAL_PLAN_CODE,
    process.env.PAYSTACK_BUSINESS_ANNUAL_PLAN_CODE,
  ]
  return annualCodes.includes(planCode) ? 'annual' : 'monthly'
}
