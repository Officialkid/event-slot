// Payment method selection per country, and Paystack config builder.
// Live billing currently settles in KES so both cards and M-Pesa use a supported currency.

export function getPaymentMethodsForCountry(countryCode: string): string[] {
  const methods: Record<string, string[]> = {
    KE:      ['mpesa', 'card'],
    NG:      ['card', 'bank_transfer'],
    GH:      ['mobile_money', 'card'],
    ZA:      ['card'],
    DEFAULT: ['card'],
  }
  return methods[countryCode] ?? methods.DEFAULT
}

/** Build a Paystack initialisation config charged in KES (minor units). */
export function getPaystackConfig(
  kesAmount: number,
  email: string,
  countryCode: string
) {
  return {
    email,
    amount:   Math.round(kesAmount * 100), // Paystack expects the currency minor unit
    currency: 'KES',
    channels: getPaymentMethodsForCountry(countryCode),
    metadata: { countryCode },
  }
}
