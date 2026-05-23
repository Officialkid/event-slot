'use client'

import { useState, useEffect } from 'react'
import { COUNTRY_CURRENCY, DEFAULT_CURRENCY } from '@/lib/currency'

export function useUserCountry() {
  const [countryCode, setCountryCode] = useState('US')

  useEffect(() => {
    fetch('/api/user/country')
      .then(r => r.json())
      .then((d: { countryCode?: string }) => {
        if (d.countryCode) setCountryCode(d.countryCode)
      })
      .catch(() => {})
  }, [])

  const currency = COUNTRY_CURRENCY[countryCode] ?? DEFAULT_CURRENCY
  return { countryCode, currency }
}
