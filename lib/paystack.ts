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
  return res.json()
}

export function getPlanFromPlanCode(planCode: string): string {
  const proCodes = [
    process.env.PAYSTACK_PRO_MONTHLY_PLAN_CODE,
    process.env.PAYSTACK_PRO_ANNUAL_PLAN_CODE,
  ]
  const businessCodes = [
    process.env.PAYSTACK_BUSINESS_MONTHLY_PLAN_CODE,
    process.env.PAYSTACK_BUSINESS_ANNUAL_PLAN_CODE,
  ]
  if (proCodes.includes(planCode)) return 'pro'
  if (businessCodes.includes(planCode)) return 'business'
  return 'free'
}

export function getBillingCycleFromPlanCode(planCode: string): string {
  const annualCodes = [
    process.env.PAYSTACK_PRO_ANNUAL_PLAN_CODE,
    process.env.PAYSTACK_BUSINESS_ANNUAL_PLAN_CODE,
  ]
  return annualCodes.includes(planCode) ? 'annual' : 'monthly'
}
