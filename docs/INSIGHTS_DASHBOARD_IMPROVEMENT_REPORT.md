# EventSlot Insights Dashboard — Improvement Report
**Date:** May 22, 2026  
**Scope:** Full dashboard audit + competitive analysis + prioritised roadmap

---

## 1. Executive Summary

EventSlot has a working analytics foundation across two surfaces:

| Surface | Location | What exists today |
|---|---|---|
| **Global Insight Tracker** | `/dashboard/insights` | 3 stat cards, day-of-week + monthly bar charts, audience question breakdown, AI summary |
| **Per-event Analytics tab** | `/dashboard/events/[slug]` → Analytics | Views, registrations, conversion rate, 30-day line chart, hourly bar chart, AI insight cards (credit-gated) |

Both are functional but **thin relative to what an organizer actually needs to justify running events and improving over time.** The UI is clean and on-brand — the gap is in the data depth, the story it tells, and the actions it enables.

---

## 2. Full Current-State Audit

### 2.1 Global Insight Tracker (`/dashboard/insights`)

**What it shows:**
- Events analysed (count only)
- Total respondents (count only)
- Repeat attendees (count only)
- Bar chart: registrations by day of week (all events, all time)
- Bar chart: registrations by month (last 12 months)
- Audience Q&A breakdown: top answers per custom registration question
- AI summary paragraph (~80 words)

**Critical gaps:**
1. **No revenue data** — no earnings summary, no per-event revenue, no trend
2. **No event-level breakdown** — which events drove registrations? No ranking, no comparison
3. **No growth trend** — month-over-month % change, year-over-year
4. **No funnel data** — views → registrations → confirmed vs waitlisted
5. **No attendee geography** — where are attendees coming from?
6. **No cancellation / no-show rate** — drop-off after registration
7. **No audience segmentation** — first-time vs repeat, student vs professional
8. **Repeat attendees is a raw number** — no context (% of total? same person at how many events?)
9. **Charts have no interactivity** — no click-to-drill, no hover that shows event name
10. **AI summary is generic** — same 80-word paragraph every time, no actionable recommendation
11. **No date range filter** — always all-time, no way to compare "last 90 days" vs prior
12. **No export** — no way to download the aggregated insights as CSV or PDF
13. **Empty state is a dead end** — new organizers with no data get nothing, no guidance on what to do first

### 2.2 Per-Event Analytics (`/dashboard/events/[slug]` → Analytics)

**What it shows:**
- Total views (event page hits)
- Total registrations
- Conversion rate (views → registrations)
- Confirmed vs waitlist split ratio
- Line chart: registrations per day (last 30 days)
- Bar chart: registrations by hour of day
- AI insight cards (3 cards: success / warning / info) — credit-gated at entry

**Critical gaps:**
1. **No check-in rate** — % of confirmed attendees who actually showed up
2. **No waitlist funnel** — how many waitlisted were promoted? How many declined?
3. **No source tracking** — where did registrations come from? (direct, social share, referral link)
4. **No dropout / abandonment** — started registration but didn't finish (partial form submissions)
5. **No ticket download rate** — % of confirmed attendees who actually downloaded their ticket
6. **No feedback score trend** — if feedback forms exist, show a satisfaction score on the analytics tab
7. **AI insights are credit-gated at the very first visit** — organizers hit a paywall before seeing any value
8. **"Load analytics" button on an empty tab** — analytics should auto-load; making the user click a button is friction
9. **No comparison to your previous events** — is this event performing better or worse than usual?
10. **Charts are static** — no zoom, no date range selector, no ability to isolate a specific week
11. **30-day line chart starts empty for new events** — shows a flat line with no guidance

---

## 3. Competitive Analysis

### 3.1 Eventbrite
**What they have that we don't:**
- Real-time sales dashboard (refreshes every few minutes)
- Traffic source breakdown (direct, email, social, organic search)
- Sales by ticket type (if multiple tiers)
- Geographic heatmap of buyer locations
- Marketing performance: which email campaign drove the most sales
- Conversion funnel: listing views → checkout started → purchase completed
- Revenue vs. platform fees summary
- Export to CSV / Google Sheets integration
- iOS/Android organizer app with live check-in stats

**Their weakness vs us:**
- Expensive for free-tier organizers (6.95% + $1.79 per ticket)
- No AI summaries or AI insight cards
- No waitlist intelligence (they have waitlists but no smart promotion)
- Cluttered UI — too many menus for small event organizers
- No built-in community link or WhatsApp/Telegram group integration
- No per-event team scoping (all team members see all events)

### 3.2 Luma (lu.ma)
**What they have that we don't:**
- Beautiful shareable event pages with rich preview (OG images auto-generated)
- Guest list "mood" — shows profile pictures of who is going → social proof
- Attendance trends shown on the event page itself (public)
- Calendar integration (guests add to calendar at RSVP, not after)
- Referral tracking: who invited whom
- "Co-host" mode — another person's name on the event page

**Their weakness vs us:**
- No deep organizer analytics dashboard — Luma is discovery-first, analytics-light
- No AI insights at all
- No credit-based economy
- No waitlist auto-promotion rules
- Limited for large capacity events (they're community/social events focused)
- No email campaigns dashboard

### 3.3 Hopin / RingCentral Events
**What they have that we don't:**
- Live engagement metrics (chat messages sent, Q&A submitted, poll votes)
- Session attendance heat map (when during the event were people most active)
- Sponsor ROI reporting
- Post-event recording analytics (how much of the recording was watched)
- Integration with HubSpot, Salesforce for attendee lead scoring

**Their weakness vs us:**
- Enterprise pricing — not accessible to university clubs or indie organizers
- Overkill complexity for most use cases
- No waitlist system
- No AI-generated summaries

### 3.4 TicketLeap
**What they have that we don't:**
- Dynamic reporting (they call it out as a core feature)
- Chargeback management dashboard
- Reserved seating chart builder
- On-door sales tracking (sell at the door and reconcile)

**Their weakness vs us:**
- No AI features whatsoever
- Very transactional — zero community/relationship features
- No virtual event support
- No waitlist

---

## 4. What EventSlot Has That Competitors Don't

This is our competitive moat — the things to double down on:

| Advantage | Description |
|---|---|
| **AI Insight Cards** | Per-event AI analysis (success / warning / info) — unique positioning |
| **AI Insight Tracker** | Cross-event AI summary — no competitor does this |
| **Smart Waitlist** | Auto-promotion when capacity increases, promotion email with ticket download |
| **Per-Event Team Scoping** | Collaborators see only their assigned event — more secure than Eventbrite |
| **Token/Credit Economy** | Monetisation model that doesn't charge per ticket — fair for free events |
| **Built-in Community Link** | WhatsApp/Telegram/Discord group link per event |
| **Dark-Mode First UI** | Significantly better aesthetic than all competitors |
| **University/Campus Focus** | Niche that Eventbrite/Luma both ignore |
| **Email Campaigns Built-In** | No third-party Mailchimp needed |
| **Feedback Forms** | Post-event forms built into the registration system |

---

## 5. Prioritised Improvement Roadmap

### CRITICAL — Build Now (Highest ROI, Low Effort)

#### C1. Auto-load analytics (remove the "Load analytics" button)
**Problem:** Organizers click the Analytics tab and see a blank screen with a button. This is confusing.  
**Fix:** Auto-trigger `loadAnalytics()` on tab mount (same pattern as the check-in tab). Keep the skeleton loader.  
**Effort:** 30 minutes  

#### C2. Show check-in rate on per-event analytics
**Problem:** We track check-ins but they're invisible in analytics. Organizers don't know attendance rate.  
**Fix:** Add a "Check-in Rate" stat card: `(checkedInCount / confirmedCount) × 100%`. Pull from existing check-in data.  
**Effort:** 2 hours (API + UI card)  

#### C3. Show waitlist funnel on per-event analytics
**Problem:** Waitlist is a key differentiator but its data is buried. Organizers can't see how many were promoted.  
**Fix:** Add "Waitlisted", "Promoted", "Still waiting" stat cards.  
**Effort:** 3 hours  

#### C4. Give free AI insight cards (remove credit gate at first view)
**Problem:** New organizers hit a credit paywall before seeing any AI value. They have no reason to buy credits.  
**Fix:** Give 1 free AI insight generation per event (no credits deducted). Only charge credits for re-generation.  
**Effort:** 3 hours (add `aiInsightsUsed` boolean to event or a `FreeInsight` table)  

#### C5. Month-over-month trend on Global Insight Tracker
**Problem:** The "Registrations by Month" chart shows raw numbers but no trend indicator.  
**Fix:** Add a % change badge next to each stat card: `▲ 23% vs last month`. Calculate from existing `registrationsByMonth` data.  
**Effort:** 2 hours (pure UI, data is already in the API response)  

---

### HIGH PRIORITY — Build Soon (High Value, Medium Effort)

#### H1. Top-performing events leaderboard on Insight Tracker
**Problem:** Organizers with multiple events can't tell which event performed best.  
**Fix:** Add a "Your events" leaderboard table on the Insight Tracker: event name | registrations | conversion rate | repeat attendee %. Sortable by column.  
**Data:** Already available in the `insights` API — just need to include per-event breakdown.  
**Effort:** 1 day  

#### H2. Registration source tracking
**Problem:** Organizers don't know where their registrations come from (shared link, direct, etc.)  
**Fix:** Add `ref` query param support on event pages. When someone registers, record the `source` field. Show "Registration Sources" pie chart on analytics.  
**Effort:** 2 days  

#### H3. Feedback score on Analytics tab
**Problem:** Feedback forms exist but the score is only visible in the Feedback tab — not surfaced in analytics.  
**Fix:** Show average feedback score (1–5 stars or NPS equivalent) as a stat card on the Analytics tab. Cross-link to the Feedback tab.  
**Effort:** 4 hours  

#### H4. Date range filter on Global Insight Tracker
**Problem:** Always shows all-time data. Organizers running regular events need to look at specific periods.  
**Fix:** Add a date range picker: Last 30 days / Last 90 days / Last year / All time. Pass to API as query params.  
**Effort:** 1 day  

#### H5. Audience demographics summary card
**Problem:** Question insights are shown as a list of raw answer bars. There's no "who came to your events" summary.  
**Fix:** Generate a natural-language audience profile card from question data: "Your typical attendee is a 20–25 year old student interested in tech, attending on Saturday mornings." Use the existing AI infrastructure.  
**Effort:** 1 day  

#### H6. Export analytics to CSV
**Problem:** No way to download data. Organizers working with sponsors or institutions need reports.  
**Fix:** Add "Export CSV" button on both the Global Insight Tracker and per-event Analytics tab. Include: registrations, check-in rate, question answers summary.  
**Effort:** 1 day  

---

### MEDIUM PRIORITY — Plan for Next Sprint

#### M1. Conversion funnel visualisation
A 3-step funnel chart on the per-event Analytics tab:  
`Event page views → Registration started → Registration confirmed`  
This requires tracking "registration started" (form opened) as a new event — a simple beacon on form mount.

#### M2. Attendee geography (if email domain inference or phone prefix is available)
Even without GPS, you can infer region from `.ac.ke` vs `.com` vs `.edu` email domains. Show a simple "Where your attendees are from" pie chart on the Global Insight Tracker.

#### M3. Comparative event performance
On each per-event Analytics tab, show a subtle comparison: "This event has 34% more registrations than your average event at this stage." Gives organizers a benchmark.

#### M4. Waitlist intelligence widget
A dedicated card on the per-event Overview tab: "You have 12 people on the waitlist. Increasing capacity by 5 would promote the next 5. [Increase capacity]" — actionable and linked directly to the capacity modal.

#### M5. Real-time registration ticker on Overview tab
A live "ticker" showing the last 5 registrations as they come in (name + time), refreshing every 30 seconds via polling. Makes the dashboard feel alive during active registration windows.

#### M6. Post-event summary email to organizer
After an event ends, automatically send the organizer a summary email: total confirmed, check-in rate, feedback score, top question insight. No action required — just awareness.

---

### NICE TO HAVE — Long-Term Differentiators

#### N1. Public event analytics (shareable)
Let organizers optionally share a read-only analytics page with their sponsors or co-organisers. A `/events/[slug]/analytics/public?token=...` page showing a summary.

#### N2. AI "What to do next" recommendation
After generating AI insights, include a 4th card: "Suggested action" — a concrete recommendation based on the data, e.g. "Send a reminder email 48h before the event — registrations peak on Monday mornings."

#### N3. Cohort retention analysis
For organizers running a series of events (weekly seminars, monthly meetups), show which attendees come back. "60% of April attendees registered for May's event." This is a true loyalty metric.

#### N4. Social proof signals on event pages
Show live registration momentum on the public event page: "12 people registered in the last 24 hours." This drives FOMO and increases conversion — something Luma does very well with their attendee avatars.

#### N5. Integration hooks (Webhook / Zapier)
Let organizers send registration events to their own CRM, Google Sheets, or Notion. Removes the need for CSV export and positions EventSlot as a serious platform for technical organisers.

---

## 6. Unified UI Vision for the Insights Dashboard

The current Insight Tracker feels like a data dump. It should feel like a **command centre**.

### Proposed page structure (Global Insight Tracker):

```
┌──────────────────────────────────────────────────────────────────┐
│  Insight Tracker                            [Last 90 days ▼]  [Export CSV]
├─────────────┬─────────────┬─────────────┬──────────────────────┤
│ Events      │ Registrants │ Check-in    │ Repeat Attendees     │
│ 8           │ 342         │ 71%         │ 47  ▲23% vs prev    │
│ ▲2 this mo  │ ▲18% MoM    │             │                      │
├─────────────┴─────────────┴─────────────┴──────────────────────┤
│  AI Audience Profile                                            │
│  "Your typical attendee is a student (76%), registering on     │
│   Saturdays, primarily interested in tech. Repeat attendees    │
│   have grown 23% this quarter."                                 │
├──────────────────────────────────────────────────────────────────┤
│  Registration Trend (bar, last 12 months, with MoM % labels)   │
├──────────────────────────┬───────────────────────────────────────┤
│  Day of Week             │  Registration Sources                 │
│  (existing bar chart)    │  (pie: direct / shared / email / ref)│
├──────────────────────────┴───────────────────────────────────────┤
│  Your Events — Leaderboard                                       │
│  Event Name        Registrations  Check-in  Score  Trend        │
│  Dev Summit 2026   120            78%       4.8★   ▲            │
│  Hackathon Nairobi  89            65%       4.2★   ─            │
├──────────────────────────────────────────────────────────────────┤
│  Audience Insights (existing question breakdown, unchanged)      │
└──────────────────────────────────────────────────────────────────┘
```

### Proposed per-event Analytics tab upgrade:

```
┌──────────────────────────────────────────────────────────────────┐
│  Event Analytics                                  [Export CSV]   │
├────────┬──────────┬───────────┬──────────┬──────────┬───────────┤
│ Views  │ Reg'd    │ Conv. Rate│ Check-in │ Waitlist │ Promoted  │
│ 2,400  │ 120      │ 5.0%      │ 78%      │ 34       │ 8         │
├─────────────────────────────┬────────────────────────────────────┤
│ Registrations last 30 days  │ By Hour                            │
│ (existing line chart)       │ (existing bar chart)               │
├─────────────────────────────┴────────────────────────────────────┤
│  vs. Your Average Event                                          │
│  "This event has 34% more registrations than your average event  │
│   at this stage."                                                │
├──────────────────────────────────────────────────────────────────┤
│  AI Insights (1 free, credits for regen — existing 3 cards)      │
│  + 4th card: "Suggested next action"                             │
├──────────────────────────────────────────────────────────────────┤
│  Feedback Score (if feedback collected)                          │
│  4.7 / 5   ★★★★★  based on 34 responses  → View feedback        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Sequence (Recommended)

| # | Feature | Priority | Effort | Value |
|---|---|---|---|---|
| 1 | Auto-load analytics on tab switch | CRITICAL | 30 min | Removes friction |
| 2 | Check-in rate stat card | CRITICAL | 2h | Core metric missing |
| 3 | Waitlist funnel cards (promoted, remaining) | CRITICAL | 3h | Differentiator data |
| 4 | Free first AI insight (remove credit gate) | CRITICAL | 3h | Unlocks value for new users |
| 5 | Month-over-month % trend on stat cards | HIGH | 2h | Shows growth story |
| 6 | Top events leaderboard on Insight Tracker | HIGH | 1 day | Multi-event organizers love this |
| 7 | Feedback score on Analytics tab | HIGH | 4h | Cross-surface data surfacing |
| 8 | Date range filter | HIGH | 1 day | Makes data actionable |
| 9 | Audience profile AI card | HIGH | 1 day | Strongest AI differentiator |
| 10 | Export CSV | HIGH | 1 day | Unblocks institutional organizers |
| 11 | Comparative performance vs. own average | MEDIUM | 4h | Benchmarking |
| 12 | Waitlist intelligence widget on Overview | MEDIUM | 4h | Actionable insights |
| 13 | Registration source tracking | MEDIUM | 2 days | Attribution data |
| 14 | Real-time registration ticker | MEDIUM | 4h | Dashboard feel alive |
| 15 | Post-event summary email | MEDIUM | 3h | Passive engagement |
| 16 | AI "Suggested action" 4th card | NICE | 1 day | Closes the insight-to-action loop |
| 17 | Social proof on event pages | NICE | 1 day | Conversion optimisation |
| 18 | Shareable analytics page | NICE | 2 days | Sponsor reporting |

---

## 8. Summary of Competitive Positioning

| Dimension | Eventbrite | Luma | EventSlot Today | EventSlot With Roadmap |
|---|---|---|---|---|
| AI-generated insights | ✗ | ✗ | ✓ (credit-gated) | ✓ (free first use) |
| Check-in analytics | ✓ | ✗ | ✗ | ✓ |
| Waitlist intelligence | ✗ | ✗ | Partial | ✓ Full funnel |
| Cross-event analytics | ✓ (basic) | ✗ | ✓ (basic) | ✓ (deep) |
| Export | ✓ | ✗ | ✗ | ✓ |
| Source tracking | ✓ | Partial | ✗ | ✓ |
| Per-event team scoping | ✗ | ✗ | ✓ | ✓ |
| AI audience profile | ✗ | ✗ | ✗ | ✓ |
| Feedback integration | ✗ | ✗ | ✓ | ✓ Enhanced |
| University focus | ✗ | ✗ | ✓ | ✓ |
| Dark-mode first UI | ✗ | Partial | ✓ | ✓ |
| Price for free events | Free (% on paid) | Free | Free | Free |

---

*Report prepared from codebase audit of `app/(organizer)/dashboard/insights/page.tsx`, `app/api/insights/route.ts`, `app/(organizer)/dashboard/events/[slug]/page.tsx` Analytics tab, and competitive research of Eventbrite, Luma, Hopin/RingCentral Events, and TicketLeap.*
