# EventSlot — Comprehensive Platform Feature Catalog & Monetization Matrix

**Document Purpose:** Complete inventory of all platform features built across EventSlot, categorizing current capabilities and establishing a strategic roadmap for monetization tiers (Free vs. Pro vs. Pay-As-You-Go Add-ons vs. Enterprise).  
**Status:** Living Canonical Catalog  
**Last Updated:** September 2026  

---

## 🧭 1. Executive Summary & Monetization Philosophy

EventSlot was engineered to eliminate friction between an event organizer's vision and an attendee's seat. To maximize market penetration, virality, and organizer trust, the monetization philosophy balances:
1. **Unrestricted Free Tier Core:** Basic event creation, essential RSVP ticketing, QR generation, and standard scanning remain accessible to grassroots organizers, student leaders, and community meetups without paywalls.
2. **Value-Driven Pro Tier:** Features that save high-volume organizers hours of labor, provide executive reporting, remove platform branding, or unlock advanced customization.
3. **Usage-Based / Pay-As-You-Go Add-ons:** High-cost infrastructure components (cold storage vault archives beyond standard limits, high-volume WhatsApp/SMS broadcasts, AI slide deck generation overages).
4. **Enterprise / Institutional Tier:** Multi-member role governance, custom subdomains, dedicated SLA, audit log compliance, and on-premise/hybrid data retention policies.

---

## 📊 2. Strategic Tier Classification Matrix

| Feature Area | Feature Capability | Recommended Tier | Monetization Mechanism |
| :--- | :--- | :--- | :--- |
| **Event Creation** | Standard Single Event (Unlimited attendees up to venue cap) | **FREE** | Always free core capability |
| **Event Creation** | Recurring Event Engine (Daily, Weekly, Monthly recurrence rules) | **PRO** | Monthly/Annual Subscription |
| **Event Creation** | Decoupled Start/End Dates & Custom Multi-Day Slots | **FREE / PRO** | Base dates Free; Multi-day slots Pro |
| **Event Form** | Standard Registration Questions (Name, Email, Phone, Custom text) | **FREE** | Free core capability |
| **Event Form** | Reorderable Custom Form Fields & 'Other' fillable options | **FREE** | Included for optimal attendee UX |
| **Event Form** | Attendee File Uploads (CVs, Portfolios, Photo IDs) | **PRO / ADD-ON** | Backed by Cloudflare R2 storage costs |
| **Check-in & Gates** | QuickScan Live Camera QR Check-in | **FREE** | Included for seamless event gatekeeping |
| **Check-in & Gates** | DeepScan (Attendee profile context, notes, VIP badges) | **PRO** | Pro organizer productivity tool |
| **Check-in & Gates** | Verifier Access Codes (Temporary staff/volunteer PINs) | **PRO** | Included in Pro team seats |
| **Check-in & Gates** | Cryptographic HMAC-SHA256 Signed Tickets | **FREE** | Core security standard across all tiers |
| **Communications** | Automated Transactional Confirmation & Ticket Delivery | **FREE** | Free transactional emails |
| **Communications** | Custom Email Broadcast Campaigns & Rich-text Announcements | **PRO** | Included up to quota; add-on packs |
| **Communications** | Automated Waitlist Bump & Promotion Engine | **FREE / PRO** | Basic Free; Auto-escalation Pro |
| **Analytics** | Standard Registration & Attendee Count Metrics | **FREE** | Free standard dashboard |
| **Analytics** | Live Telemetry Dashboard & Real-Time Velocity Graph | **PRO** | Real-time inflow monitoring |
| **Analytics** | Multi-Event Cohort Telemetry (Selective event grouping) | **PRO** | Cross-event portfolio analysis |
| **Board / Executive** | Gemini AI Executive Presentation Deck Generator | **PRO / ADD-ON** | Included in Pro (e.g., 5 decks/mo) + Token pack |
| **Board / Executive** | Print-Ready Executive Report (16:9 Landscape PDF Export) | **PRO** | Clean board committee presentation |
| **Data Lifecycle** | Standard Active Event Access | **FREE** | Available during active event lifecycle |
| **Data Lifecycle** | 30-Day Free Retention Window (Standard post-event access) | **FREE** | Grace period before cold archive |
| **Data Lifecycle** | Cloudflare R2 Cold Storage Archive Vault (Infinite retrieval) | **PRO / ADD-ON** | Pro includes 10 archived events; $0.50/mo per extra event |
| **Security & Privacy**| AES-256-GCM Meeting Link Encryption (Zoom/Google Meet) | **FREE** | Universal privacy safeguard |
| **Security & Privacy**| PDPA/GDPR Explicit Consent Collection | **FREE** | Universal compliance requirement |
| **Team Management** | Single Organizer Account | **FREE** | Included |
| **Team Management** | Multi-User Team Roles (Collaborators, Scanners, Viewers) | **PRO / ENTERPRISE** | Per seat pricing or tier quota |
| **Ticketing & Pay** | Free RSVPs / Zero-Commission Events | **FREE** | Free for all community organizers |
| **Ticketing & Pay** | Paid Ticketing & Multi-Gateway Checkout (M-Pesa, Card) | **TRANSACTION FEE** | 2.5% - 4.5% + processing fee per paid ticket |

---

## 🔬 3. Deep Architectural Feature Breakdown

### 3.1 Event Creation, Scheduling & Form Engine
1. **Recurring Event Support:**
   - **Frequency Options:** Daily, Weekly, Bi-Weekly, Monthly.
   - **Flexible Scheduling:** Decoupled start dates and finish dates allowing recurring events spanning arbitrary ranges.
   - **Retrofit Capability:** Existing single events can be converted to recurring series directly via Edit Event without breaking existing attendee ticket links.
2. **Decoupled Time & Date Architecture:**
   - Standalone `startTime` and `endTime` string fields (`HH:mm`) stored independently from ISO dates to prevent timezone-drift bugs.
3. **Advanced Dynamic Registration Form Builder:**
   - Form questions reorderable via intuitive UI.
   - Dynamic question types: Short answer, Paragraph, Single-choice dropdown, Multiple-choice checkboxes with fillable "Other" field, File uploads.
   - Per-question mandatory flags and custom validation.
4. **Virtual & Hybrid Event Support:**
   - Private Zoom, Google Meet, or Teams URLs stored securely.
   - Automated AES-256-GCM encryption with IV at rest; revealed only to verified ticket holders.

### 3.2 Gatekeeping, Ticketing & Check-In Operations
1. **Cryptographic QR Ticketing:**
   - HMAC-SHA256 signatures embedded in every issued ticket QR code preventing counterfeiting or manual URL spoofing.
   - High-contrast visual QR cards rendered on mobile web and downloadable as PNG.
2. **Two-Tier Organizer Scanner Suite:**
   - **QuickScan:** High-throughput barcode scanner with sub-second camera focus, audio-visual feedback, and instant auto-reset for high-traffic entry lines.
   - **DeepScan:** Comprehensive gatekeeping interface showing attendee answers, custom notes, VIP designations, and multi-ticket check-ins.
3. **Verifier Access Codes:**
   - Generate time-limited 6-character access codes for event volunteers, bouncers, and gate staff.
   - Grants restricted ticket-scanning capabilities on mobile devices without requiring admin dashboard access or exposing sensitive attendee databases.
4. **Multi-Channel Ticket Verification:**
   - In-app camera stream, ticket image screenshot upload, manual alphanumeric code entry, and attendee name/email search.

### 3.3 Multi-Event Cohort Telemetry & Executive Reporting
1. **Cohort Multi-Select Telemetry Engine:**
   - Dropdown with multi-select checkboxes allowing organizers to select specific combinations of events (e.g. "Disruptors Convention" + "AI Meetup").
   - Aggregates turnout percentages, ticket velocity, check-in rate, and revenue strictly across the selected cohort.
   - Preserves custom cohort selection states across browser navigation via query params.
2. **Executive Presentation Deck Generator (Gemini AI):**
   - Synthesizes 5 comprehensive executive slides:
     - *Slide 1:* Executive Overview & Cohort Composition
     - *Slide 2:* Turnout & Capacity Benchmark
     - *Slide 3:* Registration Inflow & Velocity Dynamics
     - *Slide 4:* Ticket Tier & Demographic Engagement
     - *Slide 5:* Strategic Takeaways & Committee Action Plan
   - Gemini API prompt-engineered for boardroom clarity, with reliable deterministic fallback logic if offline or out of quota.
3. **16:9 Landscape Print & PDF Export:**
   - Fullscreen presentation modal with keyboard arrow navigation (`←`, `→`, `Esc`).
   - Dedicated `@media print` CSS formatted specifically for 16:9 landscape printing or "Save as PDF" for board committee meetings and executive summaries.

### 3.4 Data Retention, Storage & Archiving
1. **Zero-Egress Media Storage (Cloudflare R2):**
   - High-resolution event posters, hero banners, and attendee file uploads stored directly in Cloudflare R2 with custom domain delivery.
2. **Cold Storage Archive Vault:**
   - Events eligible for cold storage archiving automatically compress attendee rosters and metrics into structured JSON and upload to R2 vault storage.
   - Restores active database capacity while ensuring compliance and historical retrieval.
3. **Monetization Safeguard (Controlled Rollout):**
   - `isPricingRolloutActive()` flag ensures 30-day expiration warnings remain hidden from public users until the business team formally activates pricing.

### 3.5 Communications, Notifications & Waitlists
1. **Automated Transactional Emails:**
   - Resend API integration with verified domain delivery for instant ticket confirmation, calendar `.ics` invites, and entry barcodes.
2. **Email Campaign Dispatcher:**
   - Broadcast rich-text announcements, updates, or schedule changes to confirmed attendees.
   - Pre-send health checks, delivery status tracking, and per-attendee failure logs.
3. **Automated Waitlist Escalation:**
   - When an event hits capacity, attendees join a prioritized waitlist.
   - If capacity increases or cancellations occur, top waitlisted attendees are automatically promoted or notified.

### 3.6 Discovery, Public Portal & Mobile Experience
1. **Public Event Discovery Portal:**
   - Responsive event search, category filters, and featured event carousels.
   - Real-time remaining spot badges ("Only 3 spots left!").
2. **Progressive Web App (PWA) & Android TWA:**
   - Installable on mobile home screens with offline splash screens.
   - Google Play Store ready Trusted Web Activity (TWA) architecture.
3. **Organizer Hub & Super Admin Command Center:**
   - Complete event management lifecycle: draft, publish, pause, duplicate, close, archive.
   - Super Admin dashboard for platform-wide metrics, emergency overrides, and audit logs.

---

## 💰 4. Monetization Tiers Recommendation

### Tier 1: Community (Free)
*Target: Student leaders, community meetups, casual hosts, non-profits.*
- Unlimited Free Events & Registrations
- Standard Single Event Scheduling
- Basic Registration Form Questions
- HMAC-SHA256 Signed QR Tickets & QuickScan
- Transactional Ticket Delivery Emails
- Standard Event Dashboard Metrics
- 30-Day Post-Event Data Access

### Tier 2: Pro Organizer ($19 - $29 / month or $199 / year)
*Target: Professional organizers, corporate trainers, recurring event hosts, agencies.*
- Everything in Community, plus:
- **Recurring Events Engine** (Daily, Weekly, Monthly series)
- **DeepScan** Attendee Profile Inspection & Note Taking
- **Verifier Access Codes** for unlimited event staff/volunteers
- **Multi-Event Cohort Telemetry** & Comparative Analytics
- **Gemini AI Executive Presentation Deck Generator** & 16:9 PDF Export
- **Cloudflare R2 Cold Storage Archive Vault** (Unlimited permanent event preservation)
- **Attendee File Uploads** on registration forms
- Custom Email Broadcasts (Up to 5,000 emails/month)
- Removal of "Powered by EventSlot" branding

### Tier 3: Pay-As-You-Go Add-Ons
*Target: Flexible scaling for seasonal or high-volume needs.*
- **Extra Email Broadcast Quota:** $5 per 5,000 emails.
- **Extra AI Deck Generations:** $3 per 10 decks.
- **Paid Ticket Processing Fee:** 3.5% + $0.30 per ticket (processed via M-Pesa / Card).

### Tier 4: Enterprise / Institutions (Custom Quote)
*Target: Universities, corporate event series, governmental bodies, large festivals.*
- Everything in Pro, plus:
- Custom Domain / White-Label Portal (`events.yourcompany.com`)
- Unlimited Volunteer Verifier Codes & Role-Based Team Seats
- Dedicated Account Manager & Live Event Day Hotline
- Custom Data Retention & Dedicated Cloud Database options
- SSO / SAML Authentication

---

## 📝 5. Summary for Committee & Investor Presentations

EventSlot is technically mature across all core pillars:
1. **Infrastructure:** Next.js 16, PostgreSQL (Neon), Cloudflare R2, Google Cloud Run with automated CI/CD.
2. **Security:** HMAC-SHA256 signatures, AES-256-GCM encryption, PDPA privacy safeguards.
3. **Product Differentiation:** Built-in AI presentation generator for board committees, real-time multi-event cohort analytics, and staff verifier access codes.
4. **Monetization Readiness:** Clear separation of free core vs. premium enterprise capabilities, backed by an inactive rollout flag that can be toggled on instantly.
