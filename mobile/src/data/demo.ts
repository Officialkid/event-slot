import { NativeEvent } from "../domain/events";

export const demoEvents: NativeEvent[] = [
  {
    id: "christhood-potluck",
    slug: "christhood-potluck-edition-1-2026-897l",
    title: "Christhood Potluck Edition 1 2026",
    description: "A community potluck gathering with music, shared meals, and attendee-led fellowship moments by the waterfront.",
    status: "Active",
    dateLabel: "22 Aug 2026",
    timeLabel: "09:00 AM",
    venue: "Mystical Waterfront Garden",
    attendees: 14,
    waitlist: 0,
    capacity: 25,
    verifierCode: "897L",
    role: "Owner",
    paymentMode: "Paid externally",
    exportsReady: true,
    eventType: "physical",
    accessType: "public",
    mapDirectionsUrl: "https://maps.app.goo.gl/MHaicqJoWDunCLEV8",
    entryFeeLabel: "KSh 1,000 paid via organiser",
    whatsappNumber: "+254794059895",
    attendeeConsentEnabled: false,
    registrationQuestions: [
      {
        id: "potluck-dish",
        label: "What dish or drink will you bring?",
        type: "text",
        required: true
      },
      {
        id: "potluck-hear-about",
        label: "How did you hear about this event?",
        type: "select",
        required: false,
        options: ["Instagram", "WhatsApp group", "Friend", "Church announcement", "Other"]
      },
      {
        id: "potluck-first-time",
        label: "Is this your first Christhood gathering?",
        type: "checkbox",
        required: false,
        options: ["Yes, this is my first time", "No, I have attended before"],
        allowMultiple: false
      }
    ]
  },
  {
    id: "volunteer-checkin",
    slug: "volunteer-check-in-trial",
    title: "Volunteer Check-in Trial",
    description: "Internal volunteer rehearsal for entry flow, attendee support roles, and on-site verification before launch day.",
    status: "Draft",
    dateLabel: "Planning",
    timeLabel: "TBD",
    venue: "iSpeak Society",
    attendees: 0,
    waitlist: 0,
    capacity: 160,
    verifierCode: "V160",
    role: "Team",
    paymentMode: "Registration only",
    exportsReady: false,
    eventType: "physical",
    accessType: "private",
    registrationQuestions: [
      {
        id: "volunteer-role",
        label: "Which volunteer area are you interested in?",
        type: "select",
        required: true,
        options: ["Check-in", "Stage support", "Guest care", "Media", "Setup"]
      },
      {
        id: "volunteer-experience",
        label: "Any prior event support experience?",
        type: "textarea",
        required: false
      }
    ]
  }
];

export const dashboardMetrics = [
  { label: "Events", value: "2", trend: "Live workspace" },
  { label: "Confirmed", value: "14", trend: "Ready for export" },
  { label: "Waitlist", value: "0", trend: "No pending queue" },
  { label: "Testers", value: "3+", trend: "Growing list" }
];
