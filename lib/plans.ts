export const PLAN_LIMITS = {
  free: {
    maxActiveEvents: 1,
    maxRegistrationsPerEvent: Infinity,
    freeRegistrationsPerEvent: 100,
    dataRetentionDays: 30,
    maxTeamMembers: 1,
    maxBulkRegistration: 3,
    canExportCSV: false,
    canDownloadReport: false,
    canRemoveBranding: false,
    canDuplicateEvent: false,
    canViewAnalytics: false,
    canAccessInsightTracker: false,
    canSendFeedbackForm: false,
    canUseCustomDomain: false,
    payAsYouGo: true,
  },
  pro: {
    maxActiveEvents: Infinity,
    maxRegistrationsPerEvent: Infinity,
    freeRegistrationsPerEvent: 500,
    dataRetentionDays: Infinity,
    maxTeamMembers: 10,
    maxBulkRegistration: 20,
    canExportCSV: true,
    canDownloadReport: true,
    canRemoveBranding: true,
    canDuplicateEvent: true,
    canViewAnalytics: true,
    canAccessInsightTracker: false,
    canSendFeedbackForm: false,
    canUseCustomDomain: false,
    payAsYouGo: true,
  },
  business: {
    maxActiveEvents: Infinity,
    maxRegistrationsPerEvent: Infinity,
    freeRegistrationsPerEvent: Infinity,
    dataRetentionDays: Infinity,
    maxTeamMembers: 20,
    maxBulkRegistration: 20,
    canExportCSV: true,
    canDownloadReport: true,
    canRemoveBranding: true,
    canDuplicateEvent: true,
    canViewAnalytics: true,
    canAccessInsightTracker: true,
    canSendFeedbackForm: true,
    canUseCustomDomain: true,
    payAsYouGo: false,
  },
}

// Pay as you go pricing
export const PAYG_PRICING = {
  // Per every 100 registrations above free threshold
  registrationsPer100: 1.00,

  // One-time per event unlocks
  removeWatermark: 5.00,
  csvExportBase: 2.00,          // minimum, then per 100 registrations
  csvExportPer100: 1.00,
  wordReportBase: 3.00,
  wordReportPer100: 1.00,
  analyticsUnlock: 4.00,
  customThankYou: 2.00,
  extraActiveEvent: 3.00,       // per month per event slot
}

export function calculateOverageCost(
  registrationCount: number,
  freeThreshold: number
): number {
  if (registrationCount <= freeThreshold) return 0
  const overage = registrationCount - freeThreshold
  const blocks = Math.ceil(overage / 100)
  return blocks * PAYG_PRICING.registrationsPer100
}

export function calculateCSVCost(registrationCount: number): number {
  const base = PAYG_PRICING.csvExportBase
  const blocks = Math.ceil(registrationCount / 100)
  return base + (blocks * PAYG_PRICING.csvExportPer100)
}

export function calculateReportCost(registrationCount: number): number {
  const base = PAYG_PRICING.wordReportBase
  const blocks = Math.ceil(registrationCount / 100)
  return base + (blocks * PAYG_PRICING.wordReportPer100)
}

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free
}

export function canPerformAction(
  plan: string,
  action: keyof typeof PLAN_LIMITS.free
) {
  const limits = getPlanLimits(plan)
  return limits[action]
}
