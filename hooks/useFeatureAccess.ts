'use client'

import { useState } from 'react'

export function useFeatureAccess() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function unlockFeature({
    feature,
    eventId,
    onSuccess,
  }: {
    feature: string
    eventId?: string
    creditCost: number
    onSuccess: (creditsRemaining: number) => void
  }) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/features/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, eventId }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error ?? 'Failed to unlock feature')
        return
      }

      onSuccess(data.creditsRemaining ?? 0)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return { unlockFeature, loading, error }
}
