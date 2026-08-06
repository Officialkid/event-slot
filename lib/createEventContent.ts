export const CREATE_EVENT_COPY = {
  header: {
    title: "Create your event",
    caption: "Set it up once. Share the link. Done."
  },
  tabs: {
    setup: "Setup",
    details: "Details",
    attendees: "Attendees",
    review: "Review"
  },
  banner: {
    pricingActive: "Your current plan limits apply here. If you need more room, EventSlot will guide you clearly before anything changes.",
    pricingPaused: "Free event creation is fully open right now. Paid-event tools and billing controls will appear later when they are ready.",
    pricingPausedTitle: "Free event creation is fully open right now.",
    pricingPausedMessage: "Paid-event tools and billing controls will appear later when they are ready."
  },
  sections: {
    template: {
      title: "Start with a template",
      caption: "Choose a template or start from scratch."
    },
    eventKind: {
      title: "What kind of event is this?"
    },
    eventDetails: {
      title: "Event Details"
    },
    venueAndEntry: {
      title: "Venue and entry"
    },
    currentSetup: {
      title: "Current setup",
      caption: "Confirm the event frame here before you fill the longer organiser details."
    }
  },
  attendeeFlow: {
    summary: {
      label: "ATTENDEE FLOW",
      title: "Review the attendee journey before publishing.",
      message: "Consent, uploads, and registration wording should match the event you are collecting responses for."
    },
    registrationQuestions: {
      title: "Registration Questions",
      caption: "Consent and upload controls already affect the attendee flow while the full mobile question builder continues catching up."
    },
    consent: {
      title: "Consent",
      caption: "Turn the consent step on only when this event needs it, then write the exact wording attendees should review."
    },
    uploads: {
      title: "Attendee uploads",
      caption: "Decide whether attendees should attach documents or images before submission."
    }
  },
  review: {
    readiness: {
      label: "READY TO PUBLISH",
      readyMessage: "This draft has the minimum information needed before publishing.",
      issuesMessage: "Review the remaining issues below before you publish this event."
    },
    publishStatus: {
      label: "PUBLISH STATUS"
    },
    preview: {
      title: "Draft preview",
      caption: "This mirrors the attendee-facing summary with the same event wording, spacing, and organiser-controlled details."
    }
  },
  fields: {
    eventTitle: {
      label: "Event title",
      placeholder: "e.g. Annual team summit"
    },
    description: {
      label: "Description",
      placeholder: "Briefly describe what this event is about. Line breaks, spacing, and emojis are kept as written.",
      helper: "Tip: Date, time, and location are shown automatically from the fields above. Use this field for your caption, spacing, extra notes, and emojis exactly as you want attendees to read them.",
      mobileLabel: "Caption / description",
      mobilePlaceholder: "Keep spacing, emojis, and event wording exactly as entered.",
      mobileHelper: "Line breaks, spacing, and emojis are kept exactly as written."
    },
    eventType: {
      label: "Event type",
      physical: {
        title: "Physical event",
        caption: "People attend in person. Add a venue, Maps link, and support contact."
      },
      virtual: {
        title: "Virtual event",
        caption: "People join remotely. Add the meeting link and keep the attendee flow simple."
      }
    },
    virtualMeetingLink: {
      label: "Virtual meeting link",
      placeholder: "https://meet.google.com/..."
    },
    googleMeetLink: {
      label: "Google Meet Link",
      placeholder: "meet.google.com/abc-defg-hij"
    },
    googleMapsLink: {
      label: "Google Maps link",
      placeholder: "Paste organiser-provided Maps link",
      helper: "Use the organiser link so directions stay accurate for this exact venue."
    },
    entryFeeLabel: {
      label: "Entry / contribution label",
      placeholder: "e.g. KSh 1,000 paid via organiser",
      helper: "Use the exact amount or contribution wording attendees should see.",
      paymentsHiddenHelper: "Payments stay hidden in native. This field only explains external contribution details if the organiser adds them."
    },
    whatsappContact: {
      label: "WhatsApp contact",
      placeholder: "+254..."
    },
    consentText: {
      placeholder: "Write the consent clause attendees must review."
    }
  },
  actions: {
    saveDraft: "Save draft",
    publish: "Publish",
    clear: "Clear"
  }
} as const;
