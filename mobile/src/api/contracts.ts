export type ApiResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

export type NativeAuthMode = "demo" | "live";

export type SignupRequest = {
  name: string;
  email: string;
  password: string;
  privacyAccepted: true;
  preferredLanguage?: string;
};

export type SendOtpRequest = {
  email: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type NativeLoginRequest = {
  email: string;
  password?: string;
  otp?: string;
  deviceName?: string;
};

export type NativeSessionUser = {
  id: string;
  displayName: string;
  email: string;
  role: string;
  plan: string;
  tokenBalance: number;
};

export type NativeSessionResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: NativeSessionUser;
};

export type NativeRefreshRequest = {
  refreshToken: string;
};

export type NativeLogoutRequest = {
  refreshToken?: string;
  deviceId?: string;
};

export type CreateEventRequest = {
  title: string;
  description?: string;
  accessType: "public" | "private";
  eventType: "physical" | "virtual";
  virtualLink?: string;
  capacity: number;
  deadline: string;
  eventDate: string;
  eventEndAt?: string;
  joinOpensAt?: string;
  location?: string;
  mapDirectionsUrl?: string;
  entryFeeLabel?: string;
  showRemainingSpots?: boolean;
  attendeeConsentEnabled?: boolean;
  attendeeConsentText?: string;
  isPaid?: boolean;
  ticketsEnabled?: true;
  standardPrice?: number;
  ticketTiers?: Array<{
    name: string;
    price: number;
    capacity?: number;
  }>;
  communityLink?: string;
  whatsappNumber?: string;
  contactMode?: "email" | "whatsapp" | "both";
  imageUrl?: string;
  organizerEmail?: string;
  organizerName?: string;
  questions?: Array<{
    id: string;
    label: string;
    type: "text" | "email" | "phone" | "select" | "checkbox" | "textarea" | "number" | "file";
    required?: boolean;
    options?: string[];
    allowMultiple?: boolean;
    optionLimits?: Record<string, number | null | undefined>;
  }>;
};

export type CreatedEventResponse = {
  id: string;
  title: string;
  slug: string;
  dashboardToken?: string | null;
  verifierCode?: string | null;
  accessType: "public" | "private";
  capacity: number;
};

export type NativeDashboardStatsResponse = {
  totalEvents: number;
  totalRegistrations: number;
  activeEvents: number;
  totalWaitlisted: number;
  eventsThisMonth: number;
  registrationsThisMonth: number;
  registrationsLastMonth: number;
  conversionRate: number;
  eventsClosingThisWeek: number;
  waitlistEventCount: number;
  upcomingEvents: Array<{
    title: string;
    slug: string;
    confirmedCount: number;
    capacity: number | null;
    eventDate: string | null;
    deadline: string | null;
  }>;
  eventsNearCapacity: Array<{
    title: string;
    slug: string;
    confirmedCount: number;
    capacity: number;
    dashboardToken?: string;
  }>;
  recentActivity: Array<{
    id: string;
    name: string;
    eventTitle: string;
    eventSlug: string;
    submittedAt: string;
  }>;
};

export type NativeWorkspaceEvent = {
  id: string;
  title: string;
  slug: string;
  capacity: number | null;
  deadline: string | null;
  confirmedCount: number;
  waitlistCount: number;
  dashboardToken?: string | null;
  createdAt: string;
  archived: boolean;
  status: string | null;
  eventDate: string | null;
  eventEndAt?: string | null;
  joinOpensAt?: string | null;
  location: string | null;
  mapDirectionsUrl?: string | null;
  entryFeeLabel?: string | null;
  showRemainingSpots?: boolean | null;
  standardPrice?: number | null;
  eventType?: string | null;
  accessType?: string | null;
  verifierCode?: string | null;
  role?: "Owner" | "Team";
  exportsReady?: boolean;
};

export type NativeWorkspaceEventsResponse = {
  success: true;
  events: NativeWorkspaceEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type NativeRegistrationSummary = {
  id: string;
  answers: unknown;
  submittedAt: string;
  source?: string | null;
  waitlistPosition?: number | null;
};

export type NativeWorkspaceTicketTier = {
  id: string;
  name: string;
  presetKey?: string | null;
  badgeColor?: string | null;
  textColor?: string | null;
  metallic?: boolean | null;
  prestige?: number | null;
  priceKes: number;
  capacity: number;
  description?: string | null;
  bundleSize?: number | null;
  soldCount: number;
  waitlistCount: number;
  status: string;
};

export type NativeEventWorkspaceResponse = {
  success: true;
  event: NativeWorkspaceEvent & {
    description?: string | null;
    questions?: unknown;
    ticketsEnabled?: boolean;
    verifierCodeEnabled?: boolean;
    showRemainingSpots?: boolean | null;
    canEdit?: boolean;
    isPaid?: boolean;
    attendeeConsentEnabled?: boolean | null;
    attendeeConsentText?: string | null;
    communityLink?: string | null;
    whatsappNumber?: string | null;
    contactMode?: "WHATSAPP" | "CALL" | null;
    imageUrl?: string | null;
    ticketTiers?: NativeWorkspaceTicketTier[];
  };
  confirmed: NativeRegistrationSummary[];
  waitlist: NativeRegistrationSummary[];
};

export type NativeEventSettingsUpdateRequest = {
  title: string;
  eventType: "physical" | "virtual";
  description?: string;
  location?: string;
  mapDirectionsUrl?: string;
  entryFeeLabel?: string;
  deadline?: string;
  eventDate?: string;
  eventEndAt?: string;
  joinOpensAt?: string;
  showRemainingSpots: boolean;
  attendeeConsentEnabled: boolean;
  attendeeConsentText?: string;
  communityLink?: string;
  whatsappNumber?: string;
  contactMode: "WHATSAPP" | "CALL";
};

export type NativeCapacityUpdateRequest = {
  newCapacity: number;
};

export type NativeCapacityUpdateResponse = {
  success: true;
  promoted: number;
  newConfirmedCount: number;
  newWaitlistCount: number;
  remainingSlots: number;
  capacity: number | null;
};

export type NativeTicketTierUpdateRequest = {
  ticketTiers: Array<{
    id?: string;
    name: string;
    presetKey?: string | null;
    priceKes: number;
    capacity: number;
    description?: string | null;
    bundleSize?: number;
  }>;
};

export type NativeTicketTierUpdateResponse = {
  success: true;
  ticketTiers: NativeWorkspaceTicketTier[];
};

export type NativeEventSettingsUpdateResponse = {
  success: true;
  event: {
    slug: string;
    title: string;
    eventType: "physical" | "virtual";
    description: string | null;
    location: string | null;
    mapDirectionsUrl: string | null;
    entryFeeLabel: string | null;
    deadline: string | null;
    eventDate: string | null;
    eventEndAt: string | null;
    joinOpensAt: string | null;
    showRemainingSpots: boolean;
    attendeeConsentEnabled: boolean;
    attendeeConsentText: string | null;
    communityLink: string | null;
    whatsappNumber: string | null;
    contactMode: "WHATSAPP" | "CALL";
  };
};

export type NativeArchiveEventRequest = {
  action: "archive";
  archived: boolean;
};

export type NativeArchiveEventResponse = {
  success: true;
  event: {
    slug: string;
    archived: boolean;
  };
};

export type NativeDuplicateEventResponse = {
  success: true;
  event: {
    id: string;
    slug: string;
    title: string;
  };
};

export type NativePublicTicketTier = {
  id: string;
  name: string;
  presetKey?: string | null;
  badgeColor?: string | null;
  textColor?: string | null;
  metallic?: boolean | null;
  prestige?: number | null;
  priceKes: number;
  capacity: number;
  soldCount?: number;
  waitlistCount?: number;
  description?: string | null;
  bundleSize?: number;
  status?: string;
};

export type NativePublicEventResponse = {
  success: true;
  event: {
    id: string;
    slug: string;
    title: string;
    description?: string | null;
    capacity?: number | null;
    confirmedCount: number;
    waitlistCount?: number | null;
    questions?: unknown;
    deadline?: string | null;
    eventDate?: string | null;
    eventEndAt?: string | null;
    joinOpensAt?: string | null;
    eventType?: string | null;
    accessType?: string | null;
    location?: string | null;
    mapDirectionsUrl?: string | null;
    entryFeeLabel?: string | null;
    showRemainingSpots?: boolean | null;
    attendeeConsentEnabled?: boolean | null;
    attendeeConsentText?: string | null;
    communityLink?: string | null;
    whatsappNumber?: string | null;
    contactMode?: "WHATSAPP" | "CALL" | null;
    imageUrl?: string | null;
    status?: string | null;
    isPaid?: boolean | null;
    organizerName?: string | null;
    ticketTiers?: NativePublicTicketTier[] | null;
  };
};

export type NativeExportPrepareResponse = {
  success: true;
  kind: "confirmed-csv" | "responses-pdf" | "ai-report";
  downloadUrl?: string;
  expiresAt?: string;
  jobId?: string;
  status: "ready" | "preparing";
};
