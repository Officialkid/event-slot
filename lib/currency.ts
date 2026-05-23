// Client-safe currency utilities — no Prisma, no Node-only APIs.
// Exchange rate fetching with Prisma caching lives in the API route.

export const FALLBACK_RATES: Record<string, number> = {
  KES: 130, NGN: 1600, UGX: 3700, TZS: 2600,
  GHS: 15,  ZAR: 18,  USD: 1,    GBP: 0.79, EUR: 0.92,
}

/**
 * Format a USD amount as a local currency string.
 * e.g. formatLocalAmount(1.00, 130, 'KES') → 'KSh 130'
 */
export function formatLocalAmount(
  usdAmount: number,
  rate: number,
  currencyCode: string
): string {
  const local = usdAmount * rate
  const fmt = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: currencyCode === 'USD' ? 2 : 0,
    maximumFractionDigits: currencyCode === 'USD' ? 2 : 0,
  })
  return fmt.format(local)
}

export const COUNTRY_CURRENCY: Record<string, { code: string; symbol: string; name: string }> = {
  KE: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling'    },
  NG: { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira'     },
  UG: { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling'   },
  TZ: { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling'  },
  GH: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi'      },
  ZA: { code: 'ZAR', symbol: 'R',   name: 'South African Rand' },
  US: { code: 'USD', symbol: '$',   name: 'US Dollar'           },
  GB: { code: 'GBP', symbol: '£',   name: 'British Pound'       },
  EU: { code: 'EUR', symbol: '€',   name: 'Euro'                },
}

export const DEFAULT_CURRENCY = { code: 'USD', symbol: '$', name: 'US Dollar' }
