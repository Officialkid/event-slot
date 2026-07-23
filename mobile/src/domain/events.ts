export type EventStatus = "Active" | "Draft" | "Closed";

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
};

export type EventDraft = {
  title: string;
  dateLabel: string;
  venue: string;
  capacity: string;
  description: string;
};

