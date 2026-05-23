// Payment method selection per country, and Paystack config builder.
// USD is always the billing currency at the backend — Paystack handles display conversion.

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

/** Build a Paystack initialisation config charged in USD (cents). */
export function getPaystackConfig(
  usdAmount: number,
  email: string,
  countryCode: string
) {
  return {
    email,
    amount:   Math.round(usdAmount * 100), // Paystack expects cents
    currency: 'USD',
    channels: getPaymentMethodsForCountry(countryCode),
    metadata: { countryCode },
  }
}
