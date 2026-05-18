"use client"

type UpdateEntry = {
  title: string
  points: string[]
}

type DailyUpdates = {
  date: string
  entries: UpdateEntry[]
  note?: string
}

const updates: DailyUpdates[] = [
  {
    date: "18 May 2026",
    entries: [
      {
        title: "Legal Pages Upgrade",
        points: [
          "Rebuilt Privacy Policy page with detailed startup-level policy sections.",
          "Rebuilt Terms & Conditions page with comprehensive user, organizer, and platform terms.",
          "Validated both legal pages with TypeScript and lint checks before release.",
        ],
      },
      {
        title: "Brand Colour Enforcement",
        points: [
          "Applied official EventSlot color tokens in global CSS for backgrounds, text, accent, borders, status, and leaderboard colors.",
          "Added semantic Tailwind color mappings so components use system tokens instead of ad hoc color values.",
          "Aligned legal pages and shared UI utility classes to approved design-system colors.",
        ],
      },
      {
        title: "Security Scan Hardening",
        points: [
          "Reviewed scheduled gitleaks scan findings and confirmed historical documentation/workflow false positives.",
          "Prepared gitleaks fingerprint ignore baseline to prevent recurring false-positive alert noise.",
          "Kept secret-scanning enforcement active for all other findings.",
        ],
      },
      {
        title: "Community, Referrals, and Badges",
        points: [
          "Implemented referral link generation and referral processing for signup and first event creation.",
          "Added community leaderboard endpoints and organizer dashboard community page.",
          "Added user badge APIs and public pioneer badge display support.",
          "Added scheduled leaderboard reset endpoint with secure cron token guard.",
        ],
      },
      {
        title: "Pioneer Onboarding Experience",
        points: [
          "Launched one-time Pioneer congratulations modal for eligible users in organizer dashboard layout.",
          "Added pioneer status API to fetch and mark congratulations visibility state.",
          "Removed pioneer position numbering and migrated badge model to seen-flag behavior.",
          "Added rollout scripts for pioneer badge backfill and launch announcement email workflow.",
        ],
      },
      {
        title: "Event-Day Access and Verification",
        points: [
          "Added attendee join flow with QR scan and fallback name or email lookup for event entry.",
          "Added verify-entry fallback using lookup ticket identifiers and event-window checks.",
          "Added organizer entry dashboard with live attendance metrics and recent successful scans.",
          "Added configurable join opening time support and propagated it through create/edit/settings and attendee UI logic.",
        ],
      },
    ],
  },
  {
    date: "15 May 2026",
    entries: [
      {
        title: "Phase 7 Admin Feedback Dashboard",
        points: [
          "Replaced super-admin feedback view with assistant feedback analytics dashboard.",
          "Added KPI cards for average rating, total ratings, and rating distribution.",
          "Added recent comments section with Kenya locale date formatting.",
        ],
      },
      {
        title: "Phase 8 Review-Only Architecture Notes",
        points: [
          "Documented model selection architecture as planning notes only.",
          "Captured baseline routing: llama-3.1-8b-instant for text and llama-3.2-11b-vision-preview for images.",
          "Recorded decision points before implementation (eligibility, credits, HF reliability hold).",
        ],
      },
      {
        title: "Registrations Export Upgrade",
        points: [
          "Added export format choice in organizer dashboard: CSV or Word (.docx).",
          "Extended export API to support format=csv|word.",
          "Added Word attendee export layout with table and privacy notice.",
        ],
      },
      {
        title: "Assistant Intelligence MD3 Phases 1-6",
        points: [
          "Added quota and feedback data model foundations (chat quota, assistant feedback, image count).",
          "Added rolling 5-hour quota service with text/image credit costs and admin bypass.",
          "Added assistant image upload and vision routing support.",
          "Added feedback submit endpoint and admin assistant-feedback analytics aggregation.",
          "Unified widget and full-page assistant experience and added E2E coverage.",
        ],
      },
      {
        title: "Platform and Stability Improvements",
        points: [
          "Fixed mobile dashboard UX and assistant launcher overlap behavior.",
          "Hardened deploy workflow docs-metadata push handling for concurrent updates.",
          "Resolved TypeScript/lint route typing and compatibility issues in recent API updates.",
        ],
      },
    ],
  },
  {
    date: "14 May 2026",
    entries: [],
    note: "No changelog entries were recorded for this date.",
  },
  {
    date: "13 May 2026",
    entries: [],
    note: "No changelog entries were recorded for this date.",
  },
  {
    date: "12 May 2026",
    entries: [],
    note: "No changelog entries were recorded for this date.",
  },
]

export default function AdminUpdatesPage() {
  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-[#F0EDE6] text-2xl font-bold mb-2">System Updates</h1>
      <p className="text-[#8A8A8A] text-sm mb-8">
        Timeline of key updates from 12 May 2026 onward.
      </p>

      <div className="space-y-6">
        {updates.map((day) => (
          <section key={day.date} className="rounded-xl border border-[rgba(240,237,230,0.1)] bg-[#141414] p-5">
            <h2 className="text-[#C8F55A] text-lg font-semibold mb-3">{day.date}</h2>

            {day.entries.length > 0 ? (
              <div className="space-y-4">
                <p className="text-[#A3A3A3] text-sm font-medium">Key updates done to the system:</p>
                {day.entries.map((entry, index) => (
                  <div key={`${day.date}-${index}`}>
                    <h3 className="text-[#F0EDE6] text-sm font-semibold mb-2">{index + 1}. {entry.title}</h3>
                    <ul className="list-disc pl-6 text-[#B9B9B9] text-sm space-y-1">
                      {entry.points.map((point, pi) => (
                        <li key={`${day.date}-${index}-${pi}`}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#7A7A7A] text-sm">{day.note}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
