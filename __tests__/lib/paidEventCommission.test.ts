import {
  FLAT_PAID_EVENT_COMMISSION_RATE,
  COMMISSION_RATES,
  getPaidEventCommissionRate,
  calculatePaidEventCommission,
} from '@/lib/paidEventCommission'
import { SUBSCRIPTION_PLANS, getSubscriptionPlan, formatCommissionRate } from '@/lib/subscriptionPlans'

describe('paidEventCommission - Phase 1 Flat 5% Commission', () => {
  describe('FLAT_PAID_EVENT_COMMISSION_RATE constant', () => {
    it('is set to exactly 0.05 (5%)', () => {
      expect(FLAT_PAID_EVENT_COMMISSION_RATE).toBe(0.05)
    })

    it('maps all plan keys in COMMISSION_RATES to 0.05', () => {
      expect(COMMISSION_RATES.free).toBe(0.05)
      expect(COMMISSION_RATES.standard).toBe(0.05)
      expect(COMMISSION_RATES.pro).toBe(0.05)
      expect(COMMISSION_RATES.business).toBe(0.05)
    })
  })

  describe('getPaidEventCommissionRate', () => {
    it('returns 5% for each standard subscription plan', () => {
      expect(getPaidEventCommissionRate('free')).toBe(0.05)
      expect(getPaidEventCommissionRate('standard')).toBe(0.05)
      expect(getPaidEventCommissionRate('pro')).toBe(0.05)
      expect(getPaidEventCommissionRate('business')).toBe(0.05)
    })

    it('returns 5% regardless of string casing and whitespace', () => {
      expect(getPaidEventCommissionRate('FREE')).toBe(0.05)
      expect(getPaidEventCommissionRate('  standard  ')).toBe(0.05)
      expect(getPaidEventCommissionRate('Pro')).toBe(0.05)
      expect(getPaidEventCommissionRate('BUSINESS')).toBe(0.05)
    })

    it('returns 5% for null, undefined, empty string, and unrecognized plans', () => {
      expect(getPaidEventCommissionRate(null)).toBe(0.05)
      expect(getPaidEventCommissionRate(undefined)).toBe(0.05)
      expect(getPaidEventCommissionRate('')).toBe(0.05)
      expect(getPaidEventCommissionRate('enterprise')).toBe(0.05)
      expect(getPaidEventCommissionRate('custom-vip-plan')).toBe(0.05)
    })
  })

  describe('calculatePaidEventCommission', () => {
    it('produces exactly KES 50 commission and KES 950 for organizer on a KES 1,000 ticket', () => {
      const plans = ['free', 'standard', 'pro', 'business', null, undefined, 'custom']

      for (const plan of plans) {
        const result = calculatePaidEventCommission(1000, plan)
        expect(result.commissionRate).toBe(0.05)
        expect(result.commissionAmount).toBe(50)
        expect(result.organizerAmount).toBe(950)
        expect(result.commissionAmount + result.organizerAmount).toBe(1000)
      }
    })

    it('ensures organizer receives ticket price minus 5% commission', () => {
      const prices = [100, 250, 500, 1500, 5000, 10000, 25000]

      for (const price of prices) {
        const result = calculatePaidEventCommission(price, 'pro')
        expect(result.commissionRate).toBe(0.05)
        expect(result.organizerAmount).toBe(price - result.commissionAmount)
        expect(result.commissionAmount + result.organizerAmount).toBe(price)
      }
    })

    describe('non-divisible amounts rounding without fractional KES', () => {
      it('rounds 35 KES (35 * 0.05 = 1.75) to 2 KES commission and 33 KES organizer', () => {
        const result = calculatePaidEventCommission(35, 'standard')
        expect(result.commissionAmount).toBe(2)
        expect(result.organizerAmount).toBe(33)
        expect(result.commissionAmount + result.organizerAmount).toBe(35)
        expect(Number.isInteger(result.commissionAmount)).toBe(true)
        expect(Number.isInteger(result.organizerAmount)).toBe(true)
      })

      it('rounds 75 KES (75 * 0.05 = 3.75) to 4 KES commission and 71 KES organizer', () => {
        const result = calculatePaidEventCommission(75, 'business')
        expect(result.commissionAmount).toBe(4)
        expect(result.organizerAmount).toBe(71)
        expect(result.commissionAmount + result.organizerAmount).toBe(75)
      })

      it('rounds 10 KES (10 * 0.05 = 0.5) to 1 KES commission and 9 KES organizer', () => {
        const result = calculatePaidEventCommission(10, 'free')
        expect(result.commissionAmount).toBe(1)
        expect(result.organizerAmount).toBe(9)
        expect(result.commissionAmount + result.organizerAmount).toBe(10)
      })

      it('rounds 1 KES (1 * 0.05 = 0.05) to 0 KES commission and 1 KES organizer', () => {
        const result = calculatePaidEventCommission(1, 'standard')
        expect(result.commissionAmount).toBe(0)
        expect(result.organizerAmount).toBe(1)
        expect(result.commissionAmount + result.organizerAmount).toBe(1)
      })

      it('rounds 999 KES (999 * 0.05 = 49.95) to 50 KES commission and 949 KES organizer', () => {
        const result = calculatePaidEventCommission(999, 'pro')
        expect(result.commissionAmount).toBe(50)
        expect(result.organizerAmount).toBe(949)
        expect(result.commissionAmount + result.organizerAmount).toBe(999)
      })

      it('preserves conservation of funds for every amount from 1 to 500 KES', () => {
        for (let amount = 1; amount <= 500; amount++) {
          const result = calculatePaidEventCommission(amount, 'pro')
          expect(result.commissionAmount + result.organizerAmount).toBe(amount)
          expect(Number.isInteger(result.commissionAmount)).toBe(true)
          expect(Number.isInteger(result.organizerAmount)).toBe(true)
        }
      })
    })

    describe('zero and invalid amounts handling', () => {
      it('handles 0 KES safely without NaN or negative amounts', () => {
        const result = calculatePaidEventCommission(0, 'standard')
        expect(result).toEqual({
          commissionRate: 0.05,
          commissionAmount: 0,
          organizerAmount: 0,
        })
      })

      it('handles negative amounts safely by returning 0', () => {
        const result = calculatePaidEventCommission(-500, 'pro')
        expect(result).toEqual({
          commissionRate: 0.05,
          commissionAmount: 0,
          organizerAmount: 0,
        })
      })

      it('handles NaN safely by returning 0', () => {
        const result = calculatePaidEventCommission(NaN, 'business')
        expect(result).toEqual({
          commissionRate: 0.05,
          commissionAmount: 0,
          organizerAmount: 0,
        })
      })

      it('handles Infinity safely by returning 0', () => {
        const result = calculatePaidEventCommission(Infinity, 'free')
        expect(result).toEqual({
          commissionRate: 0.05,
          commissionAmount: 0,
          organizerAmount: 0,
        })
      })
    })
  })

  describe('subscription catalog integrity', () => {
    it('sets commissionRate to 0.05 for all subscription plans', () => {
      for (const plan of SUBSCRIPTION_PLANS) {
        expect(plan.commissionRate).toBe(0.05)
      }
    })

    it('formats commission rate as "5%"', () => {
      expect(formatCommissionRate(0.05)).toBe('5%')
      for (const plan of SUBSCRIPTION_PLANS) {
        expect(formatCommissionRate(plan.commissionRate)).toBe('5%')
      }
    })

    it('preserves all subscription prices unchanged', () => {
      const free = getSubscriptionPlan('free')
      expect(free.monthlyPriceUsd).toBe(0)
      expect(free.annualPriceUsd).toBe(0)

      const standard = getSubscriptionPlan('standard')
      expect(standard.monthlyPriceUsd).toBe(9)
      expect(standard.annualPriceUsd).toBe(90)

      const pro = getSubscriptionPlan('pro')
      expect(pro.monthlyPriceUsd).toBe(25)
      expect(pro.annualPriceUsd).toBe(250)

      const business = getSubscriptionPlan('business')
      expect(business.monthlyPriceUsd).toBe(69)
      expect(business.annualPriceUsd).toBe(690)
    })

    it('preserves all attendee limits, seat limits, and features unchanged', () => {
      const free = getSubscriptionPlan('free')
      expect(free.attendeesPerEvent).toBe('55')
      expect(free.organizerSeats).toBe('1')
      expect(free.dataRetention).toBe('14 days')

      const standard = getSubscriptionPlan('standard')
      expect(standard.attendeesPerEvent).toBe('200')
      expect(standard.organizerSeats).toBe('3')
      expect(standard.waitlistCap).toBe('100')

      const pro = getSubscriptionPlan('pro')
      expect(pro.attendeesPerEvent).toBe('1,000')
      expect(pro.organizerSeats).toBe('10')
      expect(pro.waitlistCap).toBe('500')

      const business = getSubscriptionPlan('business')
      expect(business.attendeesPerEvent).toBe('Unlimited')
      expect(business.organizerSeats).toBe('30')
      expect(business.waitlistCap).toBe('Unlimited')
    })
  })
})
