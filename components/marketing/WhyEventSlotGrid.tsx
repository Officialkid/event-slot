import { CheckCircle2, QrCode, Sparkles, Users2, ShieldCheck, FileSpreadsheet, Smartphone, Clock3 } from "lucide-react"

const benefits = [
  {
    icon: Users2,
    tag: "Registration",
    title: "No Account Required for Attendees",
    description: "Remove registration friction. Attendees get their ticket confirmation in under a minute without being forced to create a password.",
  },
  {
    icon: Clock3,
    tag: "Capacity",
    title: "Automated Waitlists That Keep Fairness",
    description: "When the event fills up, demand doesn't get lost. The queue stays orderly and newly opened spots promote the next person in line.",
  },
  {
    icon: QrCode,
    tag: "Check-In",
    title: "Mobile QR Scanner with Duplicate Protection",
    description: "Scan passes at the entrance on any smartphone. The system verifies entry in milliseconds and flags repeated scans instantly.",
  },
  {
    icon: Smartphone,
    tag: "Walk-In Mode",
    title: "Venue Posters for Spontaneous Walk-Ins",
    description: "Generate a walk-in QR code for the entrance. Attendees scan, register on their own phones, and your attendance count rises live.",
  },
  {
    icon: FileSpreadsheet,
    tag: "Reporting",
    title: "One-Click Data & Attendee Exports",
    description: "Stop rebuilding spreadsheets before every event. Export verified attendance, custom question responses, and check-in logs as clean CSVs.",
  },
  {
    icon: Sparkles,
    tag: "Roadmap Teaser",
    title: "Coming Soon: ESA Intelligence",
    description: "Currently in development: the EventSlot Assistant to help organizers analyze event trends, draft communications, and summarize feedback.",
  },
]

export function WhyEventSlotGrid() {
  return (
    <section id="features" className="py-16 lg:py-24 border-t border-[#E5E7EB] bg-white">
      <div className="marketing-shell px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,128,61,0.2)] bg-[rgba(200,245,90,0.18)] px-3.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#166534]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#16A34A]" />
            Why Event Teams Choose EventSlot
          </div>
          <h2 className="mt-4 text-[2rem] sm:text-[2.6rem] font-normal tracking-tight text-[#0A0A0A] leading-tight">
            Built for the moments that{" "}
            <span className="italic font-serif text-[#166534]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              usually get messy.
            </span>
          </h2>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-[#475569] max-w-xl mx-auto">
            Designed around calm execution. From campus orientations and church gatherings to corporate workshops and conferences.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item) => {
            const Icon = item.icon
            const isRoadmap = item.tag === "Roadmap Teaser"
            return (
              <article
                key={item.title}
                className={`rounded-2xl border p-6 transition-all duration-300 relative ${
                  isRoadmap
                    ? "border-[rgba(21,128,61,0.25)] bg-[linear-gradient(180deg,#F5FDF0_0%,#FFFFFF_100%)] shadow-sm"
                    : "border-[#E5E7EB] bg-[#FAFAF9] hover:border-[#CBD5E1] hover:bg-white hover:shadow-md hover:-translate-y-1"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(21,128,61,0.2)] bg-[rgba(200,245,90,0.25)] text-[#166534]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${
                      isRoadmap
                        ? "bg-[rgba(200,245,90,0.3)] text-[#166534] border border-[rgba(21,128,61,0.2)]"
                        : "bg-[#E2E8F0] text-[#475569]"
                    }`}
                  >
                    {item.tag}
                  </span>
                </div>

                <h3 className="mt-5 text-[1.12rem] font-semibold text-[#0A0A0A] leading-snug">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-[0.88rem] leading-relaxed text-[#475569]">
                  {item.description}
                </p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default WhyEventSlotGrid
