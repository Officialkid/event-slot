import Link from "next/link"

export function MarketingFooter() {
  return (
    <footer className="border-t border-[rgba(240,237,230,0.08)] bg-[#090A08]">
      <div className="marketing-shell px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[1rem] font-semibold">
              <span className="text-[#F0EDE6]">Event</span>
              <span className="text-[#C8F55A]">Slot</span>
            </p>
            <p className="mt-2 text-[0.84rem] leading-6 text-[rgba(240,237,230,0.48)]">
              Smart registration, waitlist, and walk-in attendance for modern event teams.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.86rem] text-[rgba(240,237,230,0.68)]">
            <Link href="/pricing" className="transition-colors hover:text-white">
              Pricing
            </Link>
            <Link href="/for-universities" className="transition-colors hover:text-white">
              Universities
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms of Service
            </Link>
          </div>
        </div>

        <div className="mt-6 border-t border-[rgba(240,237,230,0.08)] pt-5 text-[0.8rem] text-[rgba(240,237,230,0.4)]">
          Copyright EventSlot 2026
        </div>
      </div>
    </footer>
  )
}
