// All features are free. The only paid action is downloading a report.
export const FEATURES_FREE = true

export const REPORT_DOWNLOAD_PRICING = {
  single: { amount: 100, downloads: 1, label: 'Single download - KSh 100' },
  bundle3: { amount: 285, downloads: 3, label: '3 downloads - KSh 285' },
  bundle6: { amount: 500, downloads: 6, label: '6 downloads - KSh 500' },
  bundle15: { amount: 1000, downloads: 15, label: '15 downloads - KSh 1,000' },
}

// Team member limits (generous but not unlimited to prevent abuse)
export const TEAM_MEMBER_LIMIT = 10

// Backward-compatible pricing keys used by legacy unlock endpoints.
export const PAYG_PRICING = {
  registrationsPer100: 0,
  removeWatermark: 0,
  csvExportBase: 0,
  csvExportPer100: 0,
  wordReportBase: 0,
  wordReportPer100: 0,
  analyticsUnlock: 0,
  customThankYou: 0,
  extraActiveEvent: 0,
}

const OPEN_LIMITS = {
  maxActiveEvents: Infinity,
  maxRegistrationsPerEvent: Infinity,
  freeRegistrationsPerEvent: Infinity,
  dataRetentionDays: Infinity,
  maxTeamMembers: TEAM_MEMBER_LIMIT,
  maxBulkRegistration: Infinity,
  canExportCSV: true,
  canDownloadReport: true,
  canRemoveBranding: false,
  canDuplicateEvent: true,
  canViewAnalytics: true,
  canAccessInsightTracker: true,
  canSendFeedbackForm: true,
  canUseCustomDomain: false,
  payAsYouGo: false,
}

export function calculateOverageCost(
  registrationCount: number,
  freeThreshold: number
): number {
  void registrationCount
  void freeThreshold
  return 0
}

export function calculateCSVCost(registrationCount: number): number {
  void registrationCount
  return 0
}

export function calculateReportCost(registrationCount: number): number {
  void registrationCount
  return 0
}

export function getPlanLimits(plan: string) {
  void plan
  return OPEN_LIMITS
}

export function canPerformAction(
  plan: string,
  action: keyof typeof OPEN_LIMITS
) {
  void plan
  return OPEN_LIMITS[action]
}
