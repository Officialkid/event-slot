import { NativeEvent } from "../domain/events";

export const demoEvents: NativeEvent[] = [
  {
    id: "christhood-potluck",
    slug: "christhood-potluck-edition-1-2026-897l",
    title: "Christhood Potluck Edition 1 2026",
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
    exportsReady: true
  },
  {
    id: "volunteer-checkin",
    slug: "volunteer-check-in-trial",
    title: "Volunteer Check-in Trial",
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
    exportsReady: false
  }
];

export const dashboardMetrics = [
  { label: "Events", value: "2", trend: "Live workspace" },
  { label: "Confirmed", value: "14", trend: "Ready for export" },
  { label: "Waitlist", value: "0", trend: "No pending queue" },
  { label: "Testers", value: "3+", trend: "Growing list" }
];
