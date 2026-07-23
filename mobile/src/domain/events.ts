export type EventStatus = "Active" | "Draft" | "Closed";
export type NativeEventType = "physical" | "virtual";
export type NativeAccessType = "public" | "private";

export type NativeEvent = {
  id: string;
  slug: string;
  title: string;
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
  exportsReady: boolean;
  eventType?: NativeEventType;
  accessType?: NativeAccessType;
  mapDirectionsUrl?: string;
  entryFeeLabel?: string;
  whatsappNumber?: string;
  attendeeConsentEnabled?: boolean;
  attendeeConsentText?: string;
};

export type EventDraft = {
  id: string;
  title: string;
  dateLabel: string;
  venue: string;
  capacity: string;
  description: string;
  eventType: NativeEventType;
  accessType: NativeAccessType;
  mapDirectionsUrl: string;
  entryFeeLabel: string;
  whatsappNumber: string;
  attendeeConsentEnabled: boolean;
  attendeeConsentText: string;
};
