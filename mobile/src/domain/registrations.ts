export type NativeRegistrationStatus = "confirmed" | "waitlist";

export type NativeRegistrationAnswerPreview = {
  label: string;
  value: string;
};

export type NativeRegistrationPreview = {
  id: string;
  attendeeName: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  status: NativeRegistrationStatus;
  submittedAtLabel: string;
  waitlistPosition?: number;
  source?: string;
  ticketCode?: string;
  confirmationCode?: string;
  tierLabel?: string;
  answers?: NativeRegistrationAnswerPreview[];
};

export type NativeRegistrationWorkspace = {
  confirmed: NativeRegistrationPreview[];
  waitlist: NativeRegistrationPreview[];
};
