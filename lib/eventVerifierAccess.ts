import { normalizeVerifierCode } from "@/lib/verifierCode"

type VerifierAccessEvent = {
  dashboardToken: string
  verifierCode?: string | null
  verifierCodeEnabled?: boolean | null
}

export function hasDashboardOrVerifierToken(token: string | null | undefined, event: VerifierAccessEvent) {
  const normalizedToken = (token ?? "").trim()
  if (!normalizedToken) return false

  if (normalizedToken === event.dashboardToken) return true

  return Boolean(
    event.verifierCodeEnabled &&
      event.verifierCode &&
      normalizeVerifierCode(normalizedToken) === normalizeVerifierCode(event.verifierCode)
  )
}
