import { NativeAttachmentRequirement } from "./attachments";

export type EventStatus = "Active" | "Draft" | "Closed";
export type NativeEventType = "physical" | "virtual";
export type NativeAccessType = "public" | "private";
export type NativeMonetizationType = "free" | "paid";
export type NativeRegistrationQuestionType = "text" | "email" | "phone" | "select" | "checkbox" | "textarea" | "number" | "file";
export type NativeEventContactMode = "WHATSAPP" | "CALL";

export type NativeRegistrationQuestion = {
  id: string;
  label: string;
  type: NativeRegistrationQuestionType;
  required?: boolean;
  options?: string[];
  allowMultiple?: boolean;
  optionLimits?: Record<string, number | null | undefined>;
};

export type NativeTicketTierDraft = {
  id: string;
  name: string;
  price: string;
  capacity: string;
  presetKey?: string;
  badgeColor?: string;
  textColor?: string;
  metallic?: boolean;
  prestige?: number;
  description?: string;
  bundleSize?: string;
  soldCount?: number;
  waitlistCount?: number;
  status?: string;
};

export type NativeEvent = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  status: EventStatus;
  dateLabel: string;
  timeLabel: string;
  venue: string;
  attendees: number;
  waitlist: number;
  capacity: number;
  verifierCode: string;
  role: "Owner" | "Team";
  paymentMode: "Registration only" | "Paid externally";
  monetization?: NativeMonetizationType;
  exportsReady: boolean;
  eventType?: NativeEventType;
  accessType?: NativeAccessType;
  virtualLink?: string;
  mapDirectionsUrl?: string;
  entryFeeLabel?: string;
  showRemainingSpots?: boolean;
  standardPrice?: string;
  ticketTiers?: NativeTicketTierDraft[];
  whatsappNumber?: string;
  contactMode?: NativeEventContactMode;
  communityLink?: string;
  organizerName?: string;
  attendeeConsentEnabled?: boolean;
  attendeeConsentText?: string;
  registrationQuestions?: NativeRegistrationQuestion[];
  attachmentRequirement?: NativeAttachmentRequirement;
};

export type EventDraft = {
  id: string;
  title: string;
  dateLabel: string;
  venue: string;
  capacity: string;
  description: string;
  eventType: NativeEventType;
  virtualLink: string;
  accessType: NativeAccessType;
  monetization: NativeMonetizationType;
  mapDirectionsUrl: string;
  entryFeeLabel: string;
  showRemainingSpots: boolean;
  standardPrice: string;
  ticketTiers: NativeTicketTierDraft[];
  whatsappNumber: string;
  attendeeConsentEnabled: boolean;
  attendeeConsentText: string;
  registrationQuestions: NativeRegistrationQuestion[];
  attachmentRequirement: NativeAttachmentRequirement;
};
