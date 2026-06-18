import type { Metadata } from "next"
import { MarketingFooter } from "@/components/MarketingFooter"

export const metadata: Metadata = {
  title: "Privacy Policy - EventSlot",
  description: "How EventSlot collects, uses, stores, and protects your personal information.",
}

const sections: Array<{
  id: number
  title: string
  paragraphs?: string[]
  bullets?: string[]
}> = [
  {
    id: 1,
    title: "Who We Are",
    paragraphs: [
      "EventSlot is an event management platform that helps organizers create and manage events, registrations, attendance, confirmations, waitlists, and event coordination.",
      "EventSlot is currently in a validation and awareness stage. Features, controls, and workflows may evolve as we improve the platform.",
      "Website: www.eventsslot.com | Contact: info@eventsslot.com",
    ],
  },
  {
    id: 2,
    title: "Information We Collect",
    paragraphs: ["We collect information needed to provide and secure EventSlot."],
    bullets: [
      "Account information: name, email address, password hash, and optional profile photo.",
      "Authentication information: account data from Google Sign-In when selected by the user.",
      "Event information: event details created by organizers (title, date, location, capacity, settings).",
      "Registration information: attendee-provided registration details and form responses.",
      "Usage and security information: activity logs, abuse-prevention signals, and technical metadata.",
      "Billing/token information: transaction references and balance data. We do not store card numbers.",
    ],
  },
  {
    id: 3,
    title: "How We Use Information",
    bullets: [
      "Create and manage user accounts.",
      "Process registrations, confirmations, attendance, and waitlists.",
      "Deliver event-related and security-related communications.",
      "Operate referral, community, badge, and token features.",
      "Improve product reliability, user experience, and support quality.",
      "Detect fraud, abuse, and unauthorized access.",
      "Meet legal, operational, and accounting obligations.",
    ],
  },
  {
    id: 4,
    title: "Trust and User Safety",
    bullets: [
      "We do not sell personal data.",
      "We do not misuse attendee information.",
      "We do not send spam.",
      "Privacy and user trust are core to how EventSlot is built and operated.",
    ],
  },
  {
    id: 5,
    title: "Authentication and Security",
    paragraphs: ["EventSlot uses modern controls and protected infrastructure to reduce risk and protect user accounts."],
    bullets: [
      "HTTPS/TLS encryption in transit.",
      "Password hashing for credentials.",
      "Google Authentication support.",
      "Verified email workflows for account and security communication.",
      "Authentication checks and rate limiting on sensitive endpoints.",
    ],
  },
  {
    id: 6,
    title: "Third-Party Services",
    paragraphs: ["We may use trusted third-party providers where needed to run EventSlot."],
    bullets: [
      "Google Authentication",
      "Secure cloud hosting infrastructure",
      "Email delivery providers",
      "Managed database and storage providers",
      "Payment processors",
    ],
  },
  {
    id: 7,
    title: "Cookies and Tracking",
    paragraphs: ["We use essential cookies required for security and platform functionality."],
    bullets: [
      "Session/authentication cookies",
      "CSRF/security cookies",
      "Referral attribution cookie (limited duration)",
    ],
  },
  {
    id: 8,
    title: "Email Communications and Consent",
    paragraphs: [
      "By creating an account, users agree that EventSlot may occasionally send important platform updates, feature announcements, security notifications, event-related communications, and major upgrade notices.",
      "We keep communication relevant and limited. Users can unsubscribe from non-essential emails at any time.",
    ],
  },
  {
    id: 9,
    title: "How We Share Information",
    paragraphs: ["We share information only when required to provide the service, run trusted infrastructure, or comply with law."],
    bullets: [
      "With organizers for legitimate event operations",
      "With trusted providers supporting EventSlot operations",
      "When legally required by regulators, courts, or law enforcement",
    ],
  },
  {
    id: 10,
    title: "Data Retention",
    paragraphs: [
      "We retain data for as long as necessary to provide services, maintain security, and satisfy legal obligations.",
      "Retention controls may be updated over time as EventSlot evolves.",
    ],
  },
  {
    id: 11,
    title: "Your Rights",
    paragraphs: [
      "You may request access, correction, or deletion of your personal data, subject to applicable law.",
      "For users in Kenya, we aim to align with rights principles in the Kenya Data Protection Act (2019).",
      "Contact info@eventsslot.com for privacy requests.",
    ],
  },
  {
    id: 12,
    title: "Policy Updates",
    paragraphs: [
      "We may update this Privacy Policy when features, legal requirements, or security practices change.",
      "The Last updated date will be revised when updates are published.",
    ],
  },
  {
    id: 13,
    title: "Contact",
    paragraphs: [
      "Email: info@eventsslot.com",
      "Website: www.eventsslot.com",
      "We aim to respond to privacy enquiries within a reasonable time.",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F0EDE6]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10">
          <h1 className="mb-2 text-3xl font-bold text-text-primary">EventSlot Privacy Policy</h1>
          <p className="text-sm text-text-muted">Last updated: May 2026</p>
        </header>

        <p className="mb-8 text-sm leading-relaxed text-text-secondary">
          By using EventSlot, you agree to the data practices described in this Privacy Policy. If you do not agree,
          please discontinue use of the platform.
        </p>

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
