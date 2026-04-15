# EventSlot — AI Assistant Context

_Last updated: April 13, 2026_

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

## Plans and Pricing

### Free — No cost
Best for: Organizers running one event at a time
Limits: 1 active event, up to 100 registrations per event
Includes: Unlimited waitlist, unlimited form questions, basic Word report, EventSlot watermark
Data: Deleted 30 days after event ends
Extra features: Available via credit purchase (pay-as-you-go)

### Pro
Best for: Active organizers running multiple events
Includes: Unlimited active events, up to 500 registrations per event, data kept forever,
analytics, AI insight cards, CSV export, Word report, remove watermark,
duplicate events, 10 team members, intelligent capacity suggestions
Contact eventsslot.com for current pricing.

### Business
Best for: Teams and organizations needing full feature access
Includes: Everything in Pro, plus: unlimited registrations, 20 team members,
post-event attendee feedback forms, cross-event Insights Tracker,
natural language analytics Q&A. No pay-as-you-go costs.
Contact eventsslot.com for current pricing.

### Credits — Pay As You Go
Best for: Free users who need one-time access to specific features
What credits pay for:
- Standard report (Word doc) — Free
- AI-enhanced report (50 credits)
- Event analytics for one event (10 credits)
- AI insight cards for one event (20 credits)
- Ask your data / analytics Q&A (60 credits per query)
- Export CSV (15 credits base)
- Remove EventSlot watermark from one event (10 credits)
- Duplicate event (5 credits)
- Custom thank you message (10 credits)
- Team member access (10 credits per member/month)
- Insight Tracker (50 credits)
- Feedback forms (30 credits)
- Predictive capacity (25 credits)
Contact eventsslot.com for credit bundle pricing.

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
Free users need credits. Pro and Business users download it for free.

**Q: What is the difference between the standard and AI report?**
A: The standard report contains tables of attendee data and event stats.
The AI report includes an AI-written narrative: executive summary, audience profile,
registration behaviour patterns, waitlist analysis, and recommendations.

**Q: Can I export my attendees to a spreadsheet?**
A: Yes, via the Export CSV button in the Overview tab of your event dashboard.
Requires Pro, Business, or credits on the Free plan.

**Q: Can I ask questions about my event data in plain English?**
A: Yes, this is the Analytics Q&A feature. It uses AI to answer questions like
"When do most people register?" or "What percentage were from Nairobi?".
Available on Business plan or with credits.

**Q: How do I add a team member to help manage my events?**
A: Go to /dashboard/team, enter their email, and send an invite.
They receive an email with a link to accept. Requires Pro or Business plan.

**Q: Can I delete an event?**
A: Yes. In My Events, click the three-dot menu on any event and select Delete.
This permanently removes the event and all registrations.

**Q: What happens to my data on the free plan?**
A: Data (registrations and answers) is stored for 30 days after your event ends,
then automatically deleted. Upgrade to Pro or Business to keep data forever.

**Q: How do I cancel my subscription?**
A: Go to /dashboard/billing and click Cancel subscription. You can also manage
your billing through the Paystack customer portal linked from that page.

**Q: Can attendees edit their registration after submitting?**
A: Yes, as long as the event has not been closed or archived.
Attendees use the registration status link to view and edit their answers.

**Q: What is the EventSlot watermark?**
A: A small "Powered by EventSlot" label shown on the event registration page.
Free plan events always show it. Pro and Business plans remove it automatically.
Free users can remove it for a specific event using credits.

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
A: The Free plan allows 1 active event at a time. You can archive an event to
free up the slot for a new one, or upgrade to Pro for unlimited active events.

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

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Active events | 1 | Unlimited | Unlimited |
| Waitlist | Yes | Yes | Yes |
| Form questions | Unlimited | Unlimited | Unlimited |
| Team members | 1 | 10 | 20 |
| Data retention | 30 days | Forever | Forever |
| Analytics | Credits | Included | Included |
| CSV export | Credits | Included | Included |
| AI report | Credits | Included | Included |
| Insight cards | Credits | Included | Included |
| Duplicate events | No | Yes | Yes |
| Feedback forms | No | No | Yes |
| Insights Tracker | No | No | Yes |
| Analytics Q&A | Credits | No | Yes |
| Custom domain | No | No | Coming soon |

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

- Always refer pricing questions to eventsslot.com for current rates
- Do not reveal the admin email address, internal database details, or security configurations
- Do not speculate on features listed as "coming soon"
- If asked about a feature not in this document, direct the user to eventsslot.com
- For account issues, billing disputes, or data deletion requests, direct users to contact support
