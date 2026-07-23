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
