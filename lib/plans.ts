export const PLAN_LIMITS = {
  free: {
    maxActiveEvents: 5,
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

// Pay as you go pricing — in POINTS (100 KSH = 10 points, so 1 point = 10 KSH)
export const PAYG_PRICING = {
  // Registration is FREE for all plans — no charge
  registrationsPer100: 0,

  // One-time per event unlocks (in points)
  removeWatermark: 10,
  csvExportBase: 15,
  csvExportPer100: 0,
  wordReportBase: 0,
  wordReportPer100: 0,
  analyticsUnlock: 10,
  customThankYou: 10,
  extraActiveEvent: 0,
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
