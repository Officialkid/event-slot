import Paystack from 'paystack-node'
export const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY)

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
