import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { MobileInstallButton } from "@/components/MobileInstallButton"

export function JourneyFinalCTA() {
  return (
    <section className="py-20 lg:py-28 relative overflow-hidden bg-[#FAFAF9] border-t border-[#E5E7EB]">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-[radial-gradient(ellipse_at_bottom,rgba(200,245,90,0.18)_0%,transparent_70%)] blur-2xl" />
      </div>

      <div className="marketing-shell px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="rounded-[32px] border border-[#E5E7EB] bg-white p-8 sm:p-14 lg:p-16 text-center shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative overflow-hidden">
          <div className="mx-auto max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,128,61,0.2)] bg-[rgba(200,245,90,0.22)] px-3.5 py-1 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A]">
              <Sparkles className="h-3 w-3 text-[#16A34A]" />
              Smarter Events. Better Experiences.
            </div>

            <h2 className="mt-6 text-[2.4rem] sm:text-[3.2rem] lg:text-[3.8rem] font-normal tracking-tight text-[#0A0A0A] leading-[1.08]">
              Ready to run a{" "}
              <span className="italic font-serif text-[#166534]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
                calmer event?
              </span>
            </h2>

            <p className="mt-6 text-[1.05rem] leading-relaxed text-[#475569]">
              Create your event page in under ten minutes. Capture registrations, protect capacity, and welcome attendees at the door with one clean system.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                href="/signup"
                className="inline-flex min-h-[50px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#166534] px-8 text-[0.95rem] font-semibold text-white shadow-[0_4px_14px_rgba(22,101,52,0.25)] transition hover:bg-[#14532d] hover:scale-[1.02]"
              >
                <span>Create Your Event</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/pricing"
                className="inline-flex min-h-[50px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-[#D1D5DB] bg-white px-7 text-[0.92rem] font-medium text-[#0A0A0A] transition hover:border-[#166534] hover:bg-[#F9FAFB] shadow-sm"
              >
                View Plans &amp; Pricing
              </Link>
            </div>

            <div className="mt-8 flex items-center justify-center">
              <MobileInstallButton />
            </div>

            <div className="mt-8 text-xs text-[#6B7280]">
              No credit card required for free events · Setup takes under 10 minutes
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default JourneyFinalCTA
