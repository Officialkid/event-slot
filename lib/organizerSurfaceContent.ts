export const ORGANIZER_SURFACE_COPY = {
  dashboard: {
    header: {
      caption: "Here is what is happening with your events.",
      mobileTitle: "Here is what needs your attention today.",
      createCta: "Create new event",
    },
    metrics: {
      totalEvents: "Total events",
      registrations: "Registrations",
      activeNow: "Active now",
      onWaitlist: "On waitlist",
    },
    sections: {
      needsAttention: {
        title: "Needs attention",
        emptyTitle: "All events have room",
        emptyCaption: "No active event is currently pressing against its capacity.",
        webEmptyCaption: "All events have plenty of room.",
      },
      upcomingEvents: {
        title: "Upcoming events",
        emptyTitle: "No upcoming events yet",
        emptyCaption: "Create an event or publish a draft to populate this section.",
        webEmptyTitle: "No upcoming events",
        webEmptyCaption: "Create an event to get started.",
      },
      recentActivity: {
        title: "Recent activity",
        emptyTitle: "No recent activity",
        emptyCaption: "New registrations and submissions will appear here as your events receive responses.",
        webEmptyCaption: "No recent activity. Create a new event to get started.",
        viewAllLabel: "View all activity",
      },
      quickActions: {
        title: "Quick actions",
      },
    },
  },
  eventsList: {
    title: "Your events",
    createCta: "Create new event",
    tabs: {
      web: {
        active: "Active",
        past: "Past",
        archived: "Archived",
      },
      mobile: {
        all: "All",
        active: "Active",
        draft: "Drafts",
        closed: "Closed",
        owner: "Owner",
        team: "Team",
      },
    },
    emptyStates: {
      active: {
        heading: "No events yet",
        body: "Create your first event to get started.",
      },
      past: {
        heading: "No past events",
        body: "Events with a past deadline will appear here.",
      },
      archived: {
        heading: "Nothing archived yet",
        body: "Archived events will appear here.",
      },
      mobileNoEvents: {
        title: "No events yet",
        caption: "Create your first event or accept a team invite to see it here.",
      },
      mobileNoMatch: {
        title: "No matching events",
        caption: "Change the tab to see more events in this workspace.",
      },
    },
  },
  eventDetail: {
    backLabel: "My Events",
    tabs: {
      overview: "Overview",
      confirmed: "Confirmed",
      waitlist: "Waitlist",
      exports: "Exports",
    },
    sections: {
      eventAccess: {
        title: "Event access",
        caption: "Keep the same web-style event summary, sharing, and organiser actions in one place.",
      },
      overview: "Overview",
      exportCentre: {
        title: "Export centre",
        caption: "Prepare follow-up files from the same event workspace.",
      },
      confirmedRegistrations: "Confirmed registrations",
      waitlist: {
        title: "Waitlist",
        caption: "Waitlisted attendees appear here and can later be promoted when capacity opens up.",
        empty: "Waitlist is empty.",
      },
    },
  },
} as const;
