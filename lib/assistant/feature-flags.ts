/**
 * Server-side feature gate for live EventSlot Assistant (ESA) event creation.
 * Fails closed: returns false unless `ESA_LIVE_EVENT_CREATION_ENABLED` is explicitly set to "true".
 *
 * DEFAULT STATE: false (Disabled)
 * Live creation cannot occur in production or staging until explicitly authorized and enabled.
 */
export function isEsaLiveEventCreationEnabled(): boolean {
  const envVal = process.env.ESA_LIVE_EVENT_CREATION_ENABLED
  if (!envVal) return false
  return envVal.trim().toLowerCase() === "true"
}
