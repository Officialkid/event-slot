// Single source of truth for the coin economy.
// 1 coin = $0.05 USD exactly.

export const COIN_RATE_USD = 0.05 // $0.05 per coin

export const COIN_PACKAGES = [
  { id: 'starter', coins: 20,  usd: 1.00,  label: 'Starter', popular: false },
  { id: 'value',   coins: 50,  usd: 2.50,  label: 'Value',   popular: true  },
  { id: 'power',   coins: 100, usd: 5.00,  label: 'Power',   popular: false },
  { id: 'pro',     coins: 200, usd: 10.00, label: 'Pro',     popular: false },
  { id: 'mega',    coins: 500, usd: 25.00, label: 'Mega',    popular: false },
] as const

export const COIN_COSTS = {
  DOCUMENT_GENERATION:          20,  // $1.00
  VOICE_TRANSCRIPTION:          10,  // $0.50
  MONTHLY_FREE_TRANSCRIPTIONS:   5,
} as const
