export type TutorialStep = {
  id: string
  title: string
  description: string
  target: string
  position: "top" | "bottom" | "left" | "right" | "center"
  action?: string
  actionRoute?: string
  icon: string
  spotlight: boolean
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to EventSlot! 🎉",
    description: "You're now set up to manage events like a pro. Let us show you around in under 2 minutes.",
    target: "body",
    position: "center",
    action: "Start Tour",
    icon: "👋",
    spotlight: false,
  },
  {
    id: "dashboard_overview",
    title: "Your Command Center",
    description: "This is your dashboard. At a glance you can see total events, registrations, waitlist count, and recent activity.",
    target: '[data-tutorial="dashboard-stats"]',
    position: "bottom",
    icon: "📊",
    spotlight: true,
  },
  {
    id: "create_event",
    title: "Create Your First Event",
    description: "Click here to create an event. Give it a name, set a date, venue, and how many slots are available.",
    target: '[data-tutorial="create-event-btn"]',
    position: "bottom",
    action: "Create an Event",
    actionRoute: "/dashboard/events/new",
    icon: "✨",
    spotlight: true,
  },
  {
    id: "my_events",
    title: "Manage Your Events",
    description: "All your events live here. See who registered, who's on the waitlist, and manage everything from one place.",
    target: '[data-tutorial="my-events-nav"]',
    position: "right",
    icon: "📅",
    spotlight: true,
  },
  {
    id: "registration_link",
    title: "Share Your Registration Link",
    description: "Every event gets a unique link. Share it on WhatsApp, email, or anywhere — attendees register without creating an account.",
    target: '[data-tutorial="event-link"]',
    position: "top",
    icon: "🔗",
    spotlight: true,
  },
  {
    id: "waitlist",
    title: "Automatic Waitlist Management",
    description: "When slots fill up, EventSlot automatically puts people on a waitlist. If someone cancels, the next person is confirmed automatically.",
    target: '[data-tutorial="waitlist-section"]',
    position: "top",
    icon: "⚡",
    spotlight: true,
  },
  {
    id: "confirm_attendance",
    title: "Attendee Self-Check",
    description: "Attendees can confirm their attendance and download their QR ticket anytime — no login needed.",
    target: '[data-tutorial="confirm-attendance"]',
    position: "top",
    icon: "🎟️",
    spotlight: true,
  },
  {
    id: "notifications",
    title: "Stay in the Loop",
    description: "Notifications alert you when someone registers, joins the waitlist, or when a slot opens up.",
    target: '[data-tutorial="notifications-nav"]',
    position: "right",
    icon: "🔔",
    spotlight: true,
  },
  {
    id: "profile",
    title: "Complete Your Profile",
    description: "Add your organization name and photo so attendees recognize your events. It builds trust.",
    target: '[data-tutorial="profile-nav"]',
    position: "right",
    action: "Set Up Profile",
    actionRoute: "/dashboard/profile",
    icon: "👤",
    spotlight: true,
  },
  {
    id: "complete",
    title: "You're All Set! 🚀",
    description: "That's everything you need to know. Create your first event and start filling slots. Your attendees are waiting.",
    target: "body",
    position: "center",
    action: "Create My First Event",
    actionRoute: "/dashboard/events/new",
    icon: "🎯",
    spotlight: false,
  },
]
