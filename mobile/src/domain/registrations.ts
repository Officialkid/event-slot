export type NativeRegistrationStatus = "confirmed" | "waitlist";

export type NativeRegistrationPreview = {
  id: string;
  attendeeName: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  status: NativeRegistrationStatus;
  submittedAtLabel: string;
  waitlistPosition?: number;
  source?: string;
};

export type NativeRegistrationWorkspace = {
  confirmed: NativeRegistrationPreview[];
  waitlist: NativeRegistrationPreview[];
};
