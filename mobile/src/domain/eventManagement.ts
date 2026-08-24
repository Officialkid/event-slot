import { NativeTicketTierDraft } from "./events";

export type NativeEventSettingsDraft = {
  eventSlug: string;
  title: string;
  eventType: "physical" | "virtual";
  capacity: string;
  description: string;
  location: string;
  mapDirectionsUrl: string;
  entryFeeLabel: string;
  deadline: string;
  eventDate: string;
  eventEndAt: string;
  joinOpensAt: string;
  showRemainingSpots: boolean;
  attendeeConsentEnabled: boolean;
  attendeeConsentText: string;
  communityLink: string;
  whatsappNumber: string;
  contactMode: "WHATSAPP" | "CALL";
  ticketTiers: NativeTicketTierDraft[];
  feedbackEnabled: boolean;
  archived: boolean;
  deleted: boolean;
  duplicatedAt?: string;
  updatedAt: string;
};

export type NativeEventTeamMember = {
  id: string;
  email: string;
  role: "Editor" | "Viewer";
  status: "Active" | "Pending";
  addedAt: string;
};
