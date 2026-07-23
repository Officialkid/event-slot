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
  attendeeConsentEnabled?: boolean;
  attendeeConsentText?: string;
  isPaid?: false;
  ticketsEnabled?: true;
  communityLink?: string;
  whatsappNumber?: string;
  contactMode?: "email" | "whatsapp" | "both";
  imageUrl?: string;
  organizerEmail?: string;
  organizerName?: string;
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
  location: string | null;
  mapDirectionsUrl?: string | null;
  entryFeeLabel?: string | null;
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

export type NativeEventWorkspaceResponse = {
  success: true;
  event: NativeWorkspaceEvent & {
    description?: string | null;
    questions?: unknown;
    ticketsEnabled?: boolean;
    verifierCodeEnabled?: boolean;
    canEdit?: boolean;
    attendeeConsentEnabled?: boolean | null;
    attendeeConsentText?: string | null;
    imageUrl?: string | null;
  };
  confirmed: NativeRegistrationSummary[];
  waitlist: NativeRegistrationSummary[];
};
