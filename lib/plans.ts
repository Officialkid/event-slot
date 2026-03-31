export const PLAN_LIMITS = {
  free: {
    maxActiveEvents: 1,
    maxRegistrationsPerEvent: 100,
    dataRetentionDays: 30,
    maxTeamMembers: 0,
    maxBulkRegistration: 3,
    canExportCSV: false,
    canDownloadReport: false,
    canRemoveBranding: false,
    canDuplicateEvent: false,
    canViewAnalytics: false,
    canAccessInsightTracker: false,
    canSendFeedbackForm: false,
    canUseCustomDomain: false,
  },
  pro: {
    maxActiveEvents: Infinity,
    maxRegistrationsPerEvent: 500,
    dataRetentionDays: Infinity,
    maxTeamMembers: 2,
    maxBulkRegistration: 20,
    canExportCSV: true,
    canDownloadReport: true,
    canRemoveBranding: true,
    canDuplicateEvent: true,
    canViewAnalytics: true,
    canAccessInsightTracker: false,
    canSendFeedbackForm: false,
    canUseCustomDomain: false,
  },
  business: {
    maxActiveEvents: Infinity,
    maxRegistrationsPerEvent: Infinity,
    dataRetentionDays: Infinity,
    maxTeamMembers: 5,
    maxBulkRegistration: 20,
    canExportCSV: true,
    canDownloadReport: true,
    canRemoveBranding: true,
    canDuplicateEvent: true,
    canViewAnalytics: true,
    canAccessInsightTracker: true,
    canSendFeedbackForm: true,
    canUseCustomDomain: true,
  },
}

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free
}

export function canPerformAction(plan: string, action: keyof typeof PLAN_LIMITS.free) {
  const limits = getPlanLimits(plan)
  return limits[action]
}
