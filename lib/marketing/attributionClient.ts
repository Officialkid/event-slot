/**
 * First-party client-side attribution helper for EventSlot Marketing Hub.
 * Automatically captures UTM parameters on landing and stores them in sessionStorage/cookies.
 */

export interface StoredAttribution {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  utmId?: string
  trackingLinkId?: string
  timestamp: string
}

export function parseCurrentUtmParams(): StoredAttribution | null {
  if (typeof window === "undefined") return null

  try {
    const params = new URLSearchParams(window.location.search)
    const utmSource = params.get("utm_source")?.trim().toLowerCase()
    const utmMedium = params.get("utm_medium")?.trim().toLowerCase()
    const utmCampaign = params.get("utm_campaign")?.trim().toLowerCase()
    const utmContent = params.get("utm_content")?.trim()
    const utmTerm = params.get("utm_term")?.trim()
    const utmId = params.get("utm_id")?.trim()

    if (utmSource || utmCampaign) {
      const data: StoredAttribution = {
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        utmId,
        timestamp: new Date().toISOString(),
      }

      // Persist in sessionStorage
      sessionStorage.setItem("es_mkt_session_utm", JSON.stringify(data))

      // Also persist in localStorage for first-touch preservation
      if (!localStorage.getItem("es_mkt_first_utm")) {
        localStorage.setItem("es_mkt_first_utm", JSON.stringify(data))
      }

      return data
    }
  } catch (err) {
    console.debug("[Attribution parse error]", err)
  }

  return null
}

export function getActiveAttribution(): StoredAttribution | null {
  if (typeof window === "undefined") return null

  try {
    const sessionData = sessionStorage.getItem("es_mkt_session_utm")
    if (sessionData) return JSON.parse(sessionData)

    const firstData = localStorage.getItem("es_mkt_first_utm")
    if (firstData) return JSON.parse(firstData)
  } catch {}

  return null
}

export async function trackMarketingConversion(
  action: "SIGNUP" | "EVENT_CREATED" | "EVENT_PUBLISHED" | "TICKET_PURCHASE",
  metadata?: Record<string, any>
) {
  if (typeof window === "undefined") return

  try {
    const attribution = getActiveAttribution()
    const landingPath = window.location.pathname

    await fetch("/api/marketing/attribution/touch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        landingPath,
        utmSource: attribution?.utmSource,
        utmMedium: attribution?.utmMedium,
        utmCampaign: attribution?.utmCampaign,
        utmContent: attribution?.utmContent,
        utmTerm: attribution?.utmTerm,
        utmId: attribution?.utmId,
        trackingLinkId: attribution?.trackingLinkId,
        metadata,
      }),
      keepalive: true,
    })
  } catch (err) {
    console.debug("[Conversion track error]", err)
  }
}
