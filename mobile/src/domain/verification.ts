export type VerificationStatus = "idle" | "lookup-ready" | "verified" | "already-used" | "not-found" | "error";

export type VerificationRequest = {
  eventSlug: string;
  verifierToken: string;
  ticketCode?: string;
  identity?: string;
  qrPayload?: string;
  entrantName?: string;
};

export type VerificationTicket = {
  registrationId: string;
  registrationNumber?: number | null;
  attendeeName: string;
  attendeeEmail?: string | null;
  ticketCode: string;
  confirmationCode?: string | null;
  checkedIn: boolean;
  checkedInAt?: string | null;
  admissionsTotal: number;
  admissionsUsed: number;
  admissionsRemaining: number;
};

export type VerificationResult = {
  status: VerificationStatus;
  message: string;
  ticket?: VerificationTicket;
};

export type VerifierAccessRequest = {
  verifierCode: string;
  challengeToken?: string;
};

export type VerifierAccessResult = {
  eventId: string;
  slug: string;
  title: string;
  verifierToken: string;
  ticketsEnabled: boolean;
};
