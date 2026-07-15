import type { Metadata } from "next"
import { MarketingFooter } from "@/components/MarketingFooter"

export const metadata: Metadata = {
  title: "Terms & Conditions - EventSlot",
  description: "The terms that govern use of EventSlot.",
}

const sections: Array<{
  id: number
  title: string
  paragraphs?: string[]
  bullets?: string[]
}> = [
  {
    id: 1,
    title: "Introduction",
    paragraphs: [
      "These Terms & Conditions govern your use of EventSlot at www.eventsslot.com.",
      "By accessing or using EventSlot, you agree to these terms and our Privacy Policy.",
    ],
  },
  {
    id: 2,
    title: "User Agreement During Signup",
    paragraphs: [
      "By creating an account, you agree to our Privacy Policy and Terms & Conditions.",
      "If you do not agree, do not create an account or use the platform.",
      "Where a registration or event workflow asks for explicit data-processing consent, you must provide that consent before the submission can be accepted.",
    ],
  },
  {
    id: 3,
    title: "User Accounts",
    bullets: [
      "You are responsible for information submitted under your account.",
      "Keep your credentials confidential.",
      "You must provide accurate information and keep it updated.",
      "You are responsible for activity performed through your account unless caused by EventSlot security failure.",
    ],
  },
  {
    id: 4,
    title: "Authentication and Security",
    paragraphs: [
      "EventSlot may use Google Authentication, secure hosting, verified emails, rate limiting, sign-in slowdowns, temporary account lockouts, and protected infrastructure controls to improve security and trust.",
      "No system is completely risk free, but we continuously improve safeguards as the platform grows and may introduce additional verification steps where abuse patterns are detected.",
    ],
  },
  {
    id: 5,
    title: "Email Communications",
    paragraphs: [
      "By signing up, you agree that EventSlot may send important platform updates, feature announcements, security notifications, event-related communications, and major upgrade notices.",
      "EventSlot aims to keep communication relevant and limited. Users can unsubscribe from non-essential communications.",
    ],
  },
  {
    id: 6,
    title: "Organizer Responsibilities",
    bullets: [
      "Organizers are responsible for event content, accuracy, and attendee communications.",
      "Organizers must not publish unlawful, misleading, abusive, or fraudulent event content.",
      "Organizers must handle attendee information responsibly and only for legitimate event operations.",
    ],
  },
  {
    id: 7,
    title: "Acceptable Use",
    bullets: [
      "Do not use EventSlot to spam, scam, or impersonate others.",
      "Do not attempt unauthorized access to data, systems, or accounts.",
      "Do not interfere with normal platform operation.",
      "Do not automate abusive sign-in, scraping, scanning, or AI-usage activity intended to exhaust credits, traffic, or infrastructure.",
      "Do not use EventSlot for unlawful activity.",
    ],
  },
  {
    id: 8,
    title: "Tokens, Referrals, and Community Features",
    paragraphs: [
      "EventSlot may offer tokens, referrals, badges, and leaderboard features. Rules may change to prevent abuse or improve fairness.",
      "EventSlot may suspend, adjust, or reverse rewards where abuse, fraud, or technical errors are detected.",
    ],
  },
  {
    id: 9,
    title: "Paid Events, Commission, and Refunds",
    paragraphs: [
      "For paid events, EventSlot deducts a platform commission from each successful ticket payment based on the organiser's active plan.",
      "EventSlot's platform commission is non-refundable. If an organiser refunds an attendee for any reason, the refunded amount is deducted from the organiser's own net earnings and the commission remains retained by EventSlot.",
      "EventSlot may temporarily disable, limit, or place billing and payment features into maintenance mode before full commercial rollout, including where test-mode processors or infrastructure approval steps are still being finalised.",
    ],
  },
  {
    id: 10,
    title: "Platform Availability",
    paragraphs: [
      "We aim for reliable availability, but we do not guarantee uninterrupted service.",
      "EventSlot may experience downtime, maintenance windows, or third-party service interruptions.",
    ],
  },
  {
    id: 11,
    title: "Intellectual Property",
    paragraphs: [
      "EventSlot branding, software, and platform content are owned by EventSlot or its licensors.",
      "You retain ownership of your event content, but grant EventSlot permission to process and display it to provide the service.",
    ],
  },
  {
    id: 12,
    title: "Account Suspension or Termination",
    paragraphs: [
      "EventSlot may suspend or terminate accounts that violate these terms, create legal risk, or harm users or platform integrity.",
      "Where reasonable, we may provide notice and an opportunity to resolve violations.",
    ],
  },
  {
    id: 13,
    title: "Limitation of Liability",
    paragraphs: [
      "EventSlot is provided on an as available basis. To the extent permitted by law, EventSlot is not liable for indirect or consequential losses resulting from platform use.",
      "Nothing in these terms excludes liability that cannot be excluded under applicable law.",
    ],
  },
  {
    id: 14,
    title: "Changes to the Platform and Terms",
    paragraphs: [
      "EventSlot is an evolving platform in an early growth stage. We may introduce new features, retire features, or update workflows.",
      "We may update these terms when necessary. Continued use after updates means you accept the revised terms.",
    ],
  },
  {
    id: 15,
    title: "Contact Information",
    paragraphs: [
      "If you have legal or policy questions, contact us at info@eventsslot.com.",
      "Website: www.eventsslot.com",
    ],
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F0EDE6]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10">
          <h1 className="mb-2 text-3xl font-bold text-text-primary">EventSlot Terms &amp; Conditions</h1>
          <p className="text-sm text-text-muted">Last updated: July 2026</p>
        </header>

        <div className="space-y-10">
          {sections.map((section) => (
            <article key={section.id}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-text-primary">
                <span className="font-mono text-sm text-accent">{section.id}.</span>
                {section.title}
              </h2>

              <div className="space-y-3 text-sm leading-relaxed text-text-secondary">
                {section.paragraphs?.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}

                {section.bullets && (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.bullets.map((bullet, index) => (
                      <li key={index}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>

        <footer className="mt-12 border-t border-border-brand pt-8 text-center">
          <p className="text-xs text-text-muted">
            Questions? Email{" "}
            <a href="mailto:info@eventsslot.com" className="text-accent hover:underline">
              info@eventsslot.com
            </a>
          </p>
        </footer>
      </div>
      <MarketingFooter />
    </main>
  )
}
