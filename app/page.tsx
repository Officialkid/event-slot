export default function Home() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F0EDE6]">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-[var(--accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Smart registration
            </div>
            <div className="space-y-4">
              <h1 className="hero-heading font-semibold">
                <span className="block">Your event, your slots,</span>
                <span className="block text-[var(--accent)] italic">zero chaos.</span>
              </h1>
              <p className="max-w-2xl body-text text-[rgba(240,237,230,0.75)] sm:text-lg">
                Share a link. Watch registrations fill. Overflow goes to a waitlist automatically — no spreadsheets, no DMs, no manual tracking.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <a href="/create" className="btn-base btn-primary w-full sm:w-auto">
                Create your event
              </a>
              <a href="#how-it-works" className="btn-base btn-ghost w-full sm:w-auto">
                See how it works
              </a>
            </div>
          </div>

          <div className="fade-up fade-up-delay-1 surface border-[rgba(240,237,230,0.08)] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-[#F7685B]" />
                <span className="h-3 w-3 rounded-full bg-[#F2C94C]" />
                <span className="h-3 w-3 rounded-full bg-[#33D69F]" />
                <div className="ml-auto rounded-full border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-[rgba(240,237,230,0.7)]">
                  eventslot.co/nairobi-founders-meetup
                </div>
              </div>

              <div className="rounded-3xl bg-[#0A0A0A] p-6">
                <div className="text-sm uppercase tracking-[0.2em] text-[rgba(240,237,230,0.45)]" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  Nairobi Founders Meetup
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[rgba(240,237,230,0.45)]">
                  <span>Sat 12 Apr · 6PM</span>
                  <span className="h-1 w-1 rounded-full bg-[rgba(240,237,230,0.18)]" />
                  <span>iHub, Nairobi</span>
                </div>

                <div className="mt-6 rounded-2xl border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
                  <div className="mb-3 flex items-center justify-between text-sm text-[rgba(240,237,230,0.7)]">
                    <span>11 spots left</span>
                    <span>out of 50</span>
                  </div>
                  <div className="progress-bar h-3 rounded-full">
                    <div className="progress-fill rounded-full" style={{ width: "78%" }} />
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-[rgba(255,255,255,0.04)] p-3 text-sm text-[rgba(240,237,230,0.75)]">
                    Full name
                  </div>
                  <div className="rounded-2xl bg-[rgba(255,255,255,0.04)] p-3 text-sm text-[rgba(240,237,230,0.75)]">
                    Email address
                  </div>
                  <button className="btn-base btn-primary w-full">
                    Register now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.04)] p-1">
          <div className="grid divide-y divide-[rgba(240,237,230,0.08)] sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
            {[
              {
                number: "01",
                title: "Set your limit",
                description: "Define exactly how many people can attend. No limit? Leave it open. You are in control.",
              },
              {
                number: "02",
                title: "Waitlist runs itself",
                description: "When slots fill up, registrations keep coming — they just queue automatically. FIFO. Fair. Hands-free.",
              },
              {
                number: "03",
                title: "One link, done",
                description: "Share a single URL. Attendees register on any device. No app, no account, no friction.",
              },
              {
                number: "04",
                title: "Open more slots",
                description: "Increase capacity anytime. Waitlisted people get confirmed automatically, in order.",
              },
            ].map((feature) => (
              <div key={feature.number} className="flex flex-col gap-4 rounded-3xl bg-[#0A0A0A] p-8 first:border-b first:border-[rgba(240,237,230,0.08)] sm:first:border-b-0 sm:first:border-r sm:last:border-l-0">
                <span className="label-text">{feature.number}</span>
                <h3 className="section-title font-semibold">{feature.title}</h3>
                <p className="text-sm leading-7 text-[rgba(240,237,230,0.65)]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="get-started" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border-t border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.04)] px-8 py-12 text-center">
          <h2 className="page-heading font-semibold">Ready to run your event the right way?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[rgba(240,237,230,0.7)]">Takes less than 3 minutes to set up.</p>
          <a href="/create" className="btn-base btn-primary mt-8 inline-flex">
            Create an event — it’s free
          </a>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-4 pb-12 text-sm text-[rgba(240,237,230,0.65)] sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-t border-[rgba(240,237,230,0.08)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>© 2026 EventSlot</div>
          <div>Built for event organizers who move fast.</div>
        </div>
      </footer>
    </main>
  );
}
