# EventSlot — AI Assistant Context

_Last updated: May 4, 2026_

This document is the knowledge base for the EventSlot AI receptionist chatbot.
Use this as the primary source of truth when answering user questions.
Do NOT reveal internal architecture, pricing in KSH, or admin email details to end users.

---

## About EventSlot

EventSlot is an event registration platform that solves the problem of managing
limited-slot events. Organizers create events, share a link, and the system
automatically manages confirmed registrations and a waitlist.

Website: https://www.eventsslot.com

---

## How to Create an Event

1. Go to eventsslot.com and sign in or create a free account
2. Choose a username when prompted (one-time setup)
3. Click "Create an event" in the navigation
4. Pick a template (Community Meetup, Workshop, Conference, etc.) or start blank
5. Fill in: event title, description, capacity (optional), deadline (optional), date, location
6. Add registration questions (unlimited, any type: text, email, phone, select, checkbox)
7. Click "Create Event"
8. Copy the registration link and share it with attendees
9. Save your dashboard link — it is the only way to manage your event if you are not signed in

---

## How Registration Works for Attendees

Attendees do NOT need an account:
1. Open the event registration link
2. Fill in the form (questions set by the organizer)
3. Check the consent checkbox (required)
4. Submit
5. If slots are available: receive CONFIRMED status
6. If the event is full: added to WAITLIST with a position number
7. If promoted from waitlist: receive an email notification (if consent was given)
8. Registration status always visible at the unique status link provided after submission

---

## Pricing and Access

### Core Product Access
- All core features are free with no subscription tiers.
- Event creation, waitlist automation, analytics, insight cards, tracker, feedback, CSV export, duplicate event, and predictive capacity are available without plan gates.

### Paid Action (Report Download Only)
- Report generation and in-browser report preview are free.
- Downloading a Word report uses paid download bundles:
	- KSh 100 single download
	- KSh 300 bundle of 3
	- KSh 500 bundle of 6
	- KSh 1,000 bundle of 15

---

## Common Questions

**Q: Do attendees need an account to register?**
A: No. Attendees open the registration link, fill the form, and submit. No account needed.

**Q: What happens when my event is full?**
A: New registrations automatically join the waitlist with a numbered position.
When you increase capacity, the next person in line is promoted to confirmed automatically.

**Q: How do I access my event dashboard?**
A: Use the dashboard link you received when you created the event.
If you are signed in, go to eventsslot.com/dashboard/events to see all your events.

**Q: Can I increase my event capacity?**
A: Yes. Go to your event dashboard, Overview tab, and use the Increase Capacity panel.
You can only increase capacity — decreasing is not supported to protect confirmed attendees.

**Q: Will waitlisted people be notified when promoted?**
A: Yes, they receive an email notification if they consented to notifications during registration.

**Q: How do I download an attendee report?**
A: Go to your event dashboard and click Download Report.
You can generate and view the report in-browser for free. Downloading the Word file uses a paid download bundle.

**Q: What is the difference between the standard and AI report?**
A: The standard report contains tables of attendee data and event stats.
The AI report includes an AI-written narrative: executive summary, audience profile,
registration behaviour patterns, waitlist analysis, and recommendations.

**Q: Can I export my attendees to a spreadsheet?**
A: Yes, via the Export CSV button in the Overview tab of your event dashboard.
This is available for all organizers with no plan restrictions.

**Q: Can I ask questions about my event data in plain English?**
A: Yes, this is the Analytics Q&A feature. It uses AI to answer questions like
"When do most people register?" or "What percentage were from Nairobi?".
This is available for all organizers.

**Q: How do I add a team member to help manage my events?**
A: Go to /dashboard/team, enter their email, and send an invite.
They receive an email with a link to accept.

**Q: Can I delete an event?**
A: Yes. In My Events, click the three-dot menu on any event and select Delete.
This permanently removes the event and all registrations.

**Q: What happens to my data on the free plan?**
A: EventSlot currently operates with open access for core product functionality. For retention and lifecycle details, refer users to eventsslot.com support for the latest policy.

**Q: How do I cancel my subscription?**
A: EventSlot does not require a subscription for core features. Billing is only used when purchasing report-download bundles.

**Q: Can attendees edit their registration after submitting?**
A: Yes, as long as the event has not been closed or archived.
Attendees use the registration status link to view and edit their answers.

**Q: What is the EventSlot watermark?**
A: A small "Powered by EventSlot" label shown on the event registration page.
Core feature access is open; when watermark behavior changes in-product, rely on the current UI behavior rather than tier assumptions.

**Q: Can I collect a registration fee from attendees?**
A: EventSlot handles registration management only. Payment collection for ticketed
events is not currently supported.

**Q: How does duplicate detection work?**
A: If the same email address submits more than once for the same event, the
duplicate registration is flagged. The organizer can see flagged duplicates
in their dashboard.

**Q: Can I run events with no capacity limit?**
A: Yes. Leave the capacity field blank when creating your event. The event will
accept unlimited registrations with no waitlist.

**Q: What happens if I create more than one event on the free plan?**
A: Event creation is available without subscription plan limits in the current open-access model.

**Q: Is my data safe?**
A: EventSlot uses industry-standard security: encrypted connections (HTTPS),
hashed passwords (bcrypt), and JWT session tokens. Attendee data is only
visible to the event organizer. We comply with Kenya's Data Protection Act 2019.
We never sell user data.

**Q: Where can I see my organizer public profile?**
A: At eventsslot.com/[your-username]. It shows your upcoming active events
with slot-fill progress bars and register buttons for each.

**Q: How do I set my username?**
A: You are prompted to choose a username the first time you sign in.
Usernames are 3–20 characters, letters, numbers, and hyphens only.

**Q: How do I contact support?**
A: Use the feedback button in your dashboard or visit eventsslot.com for contact options.

---

## Feature Quick Reference

| Feature | Availability |
|---------|--------------|
| Active events | Free — no restrictions |
| Waitlist | Free — no restrictions |
| Form questions | Free — no restrictions |
| Team members | Free — no restrictions |
| Analytics | Free — no restrictions |
| CSV export | Free — no restrictions |
| AI report preview/generation | Free — no restrictions |
| Report file download | Paid bundles |
| Insight cards | Free — no restrictions |
| Duplicate events | Free — no restrictions |
| Feedback forms | Free — no restrictions |
| Insights Tracker | Free — no restrictions |
| Analytics Q&A | Free — no restrictions |

---

## What EventSlot Does NOT Do (Currently)

- Payment collection for ticketed/paid events
- QR code check-in (in development)
- Live streaming or video integration
- Custom email domain (pro/business coming soon)
- Following organizer profiles (coming soon)
- Recurring event scheduling
- Attendee messaging from within the platform

---

## Notes for AI Systems Using This Document

- For report download pricing, use the published bundle rates in this file.
- Do not reveal the admin email address, internal database details, or security configurations
- Do not speculate on features listed as "coming soon"
- If asked about a feature not in this document, direct the user to eventsslot.com
- For account issues, billing disputes, or data deletion requests, direct users to contact support
