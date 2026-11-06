import type { Metadata } from "next"
import { MarketingFooter } from "@/components/MarketingFooter"
import { EarlyTesterPrompt } from "@/components/marketing/EarlyTesterPrompt"
import { SpatialHero } from "@/components/marketing/SpatialHero"
import { InteractiveDemonstrationEngine } from "@/components/marketing/InteractiveDemonstrationEngine"
import { WhyEventSlotGrid } from "@/components/marketing/WhyEventSlotGrid"
import { JourneyFinalCTA } from "@/components/marketing/JourneyFinalCTA"

export const metadata: Metadata = {
  title: "EventSlot — Smart Event Registration & Waitlist Platform",
  description:
    "The modern event registration system with automated capacity waitlists, instant mobile QR door check-in, and clear organizer analytics. Run your event without spreadsheets.",
  alternates: { canonical: "https://www.eventsslot.com" },
  openGraph: {
    title: "EventSlot — Smart Event Registration & Waitlist Platform",
    description:
      "Every great event starts with a better experience. Create events, share one link, and let capacity flow automatically.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EventSlot Event Registration Platform" }],
  },
}

const trustItems = [
  "Zero-Cost Free Entry",
  "Automated Capacity Waitlist",
  "Instant QR Door Check-In",
  "Venue Walk-In Poster Mode",
  "One-Click CSV & Attendance Exports",
]

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EventSlot",
    alternateName: "Event Slot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "EventSlot is an event registration platform built for organizers who run events with limited slots. Manage registrations, waitlists, and automatic confirmations.",
    url: "https://www.eventsslot.com",
    keywords: "eventslot, event slot, events slot, event registration platform, event waitlist system",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "KES",
      description: "Free plan available",
    },
    featureList: [
      "Event registration management",
      "Automatic waitlist system",
      "QR code ticket generation",
      "Confirmation tickets",
      "Organizer dashboard",
      "Walk-in venue check-in mode",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "EventSlot",
    alternateName: "Event Slot",
    url: "https://www.eventsslot.com",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://www.eventsslot.com/events?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  },
]

const testerPromptEnabled = process.env.NEXT_PUBLIC_APP_TESTER_PROMPT_ENABLED !== "false"

export default function Home() {

  return (
    <main className="min-h-screen bg-white text-[#0A0A0A] selection:bg-[rgba(200,245,90,0.4)] selection:text-[#0A0A0A]">
      {/* Search Engine Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Early Play Store Tester Prompt (Preserved) */}
      <EarlyTesterPrompt enabled={testerPromptEnabled} />

      {/* 01. Signature Spatial Hero Section */}
      <SpatialHero />

      {/* 02. Verified Capability Bar */}
      <section className="border-y border-[#E5E7EB] bg-[#FAFAF9] py-4 px-4 sm:px-6 lg:px-8">
        <div className="marketing-shell flex flex-wrap items-center justify-between gap-4">
          <div className="text-[0.76rem] font-bold uppercase tracking-[0.16em] text-[#166534] flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
            Verified Capabilities
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.85rem] text-[#475569] font-medium">
            {trustItems.map((item) => (
              <span key={item} className="flex items-center gap-2">
                <span className="text-[#16A34A]">·</span>
                <span>{item}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 03. Interactive Product Demonstration Engine (Stages 1-6) */}
      <InteractiveDemonstrationEngine />

      {/* 04. Practical Benefits Grounded in Product Truth */}
      <WhyEventSlotGrid />

      {/* 05. Final High-Contrast Conversion Banner */}
      <JourneyFinalCTA />

      {/* 06. Official Marketing Footer */}
      <MarketingFooter />
    </main>
  )
}
