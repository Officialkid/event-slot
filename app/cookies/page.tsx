import type { Metadata } from "next"
import Link from "next/link"
import { MarketingFooter } from "@/components/MarketingFooter"

export const metadata: Metadata = {
  title: "Cookie Policy - EventSlot",
  description: "Learn how EventSlot uses cookies and related technologies to keep your session secure and improve your experience.",
}

const cookieCategories = [
  {
    name: "1. Strictly Necessary (Essential) Cookies",
    required: true,
    description: "These cookies are indispensable for EventSlot to function. They allow you to securely log in, navigate between pages, and manage your events.",
    examples: [
      { name: "next-auth.session-token", purpose: "Maintains your secure logged-in session across page requests.", duration: "30 days" },
      { name: "next-auth.csrf-token", purpose: "Protects against Cross-Site Request Forgery (CSRF) attacks on form submissions.", duration: "Session" },
      { name: "next-auth.callback-url", purpose: "Remembers where to redirect you after completing authentication.", duration: "Session" },
      { name: "__Host-next-auth.csrf-token", purpose: "HTTPS-scoped secure token used in production environments.", duration: "Session" },
    ],
  },
  {
    name: "2. Functionality & Preference Cookies",
    required: false,
    description: "These store your display preferences and interaction state so you don't have to reconfigure them each visit.",
    examples: [
      { name: "eventslot_cookie_consent", purpose: "Remembers your cookie banner preference (all vs essential only).", duration: "1 year" },
      { name: "eventslot_theme", purpose: "Remembers your display theme mode (Dark / Light).", duration: "1 year" },
    ],
  },
  {
    name: "3. Security & Anti-Abuse Controls",
    required: true,
    description: "Temporary rate-limiting and lockout markers used to defend your account and registration endpoints against bot traffic and brute-force attacks.",
    examples: [
      { name: "eventslot_ip_hash", purpose: "Hashed identifier used strictly for rate-limiting ticket registration attempts.", duration: "Temporary (Minutes)" },
    ],
  },
]

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F0EDE6]">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#C8F55A]/10 text-[#C8F55A] border border-[#C8F55A]/20 mb-4">
            <span>🍪</span> Cookie Policy
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            EventSlot Cookie Policy
          </h1>
          <p className="text-sm text-[#A3A3A3]">
            Last updated: September 17, 2026 · Effective Date: September 17, 2026
          </p>
        </div>

        <div className="space-y-8 text-sm sm:text-base leading-relaxed text-[#D4D4D4]">
          <section className="bg-[#141414] border border-[#262626] rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-white mb-3">What Are Cookies?</h2>
            <p className="mb-4">
              Cookies are small text files placed on your device by websites that you visit. They are widely used to make websites work efficiently, provide secure sign-in mechanisms, and supply business insights to platform operators.
            </p>
            <p>
              At EventSlot, we believe in radical transparency. We do <strong>not</strong> sell your data, we do <strong>not</strong> use invasive third-party ad tracking cookies, and we restrict our cookies to what is strictly necessary to run a lightning-fast, secure event registration platform.
            </p>
          </section>

          {cookieCategories.map((cat, idx) => (
            <section key={idx} className="bg-[#141414] border border-[#262626] rounded-2xl p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="text-lg sm:text-xl font-semibold text-white">{cat.name}</h2>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cat.required ? 'bg-[#C8F55A]/10 text-[#C8F55A] border border-[#C8F55A]/20' : 'bg-[#2A2A2A] text-[#A3A3A3]'}`}>
                  {cat.required ? 'Always Active' : 'Optional'}
                </span>
              </div>
              <p className="text-sm text-[#A3A3A3] mb-5">{cat.description}</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#2A2A2A] text-[#A3A3A3]">
                      <th className="pb-3 pr-4 font-semibold">Cookie Name</th>
                      <th className="pb-3 pr-4 font-semibold">Purpose</th>
                      <th className="pb-3 font-semibold">Lifespan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                    {cat.examples.map((cookie, cIdx) => (
                      <tr key={cIdx} className="text-[#D4D4D4]">
                        <td className="py-3 pr-4 font-mono text-xs text-[#C8F55A]">{cookie.name}</td>
                        <td className="py-3 pr-4">{cookie.purpose}</td>
                        <td className="py-3 text-[#A3A3A3]">{cookie.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <section className="bg-[#141414] border border-[#262626] rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-white mb-3">How to Control Your Cookies</h2>
            <p className="mb-4">
              Most web browsers automatically accept cookies, but you can usually modify your browser setting to decline cookies or delete existing ones if you prefer.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-[#A3A3A3]">
              <li><strong>Chrome:</strong> Settings → Privacy and security → Third-party cookies</li>
              <li><strong>Safari:</strong> Settings → Safari → Privacy & Security → Block All Cookies</li>
              <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
              <li><strong>Edge:</strong> Settings → Cookies and site permissions → Manage and delete cookies</li>
            </ul>
            <p className="mt-4 text-xs text-[#737373]">
              Note: If you choose to disable strictly necessary cookies, you will not be able to log in, create events, or access authenticated dashboard areas on EventSlot.
            </p>
          </section>

          <section className="bg-[#141414] border border-[#262626] rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Questions & Contact</h2>
            <p className="text-sm text-[#A3A3A3]">
              If you have any questions regarding our use of cookies or privacy practices, please contact our team at{" "}
              <a href="mailto:info@eventsslot.com" className="text-[#C8F55A] underline">
                info@eventsslot.com
              </a>{" "}
              or review our{" "}
              <Link href="/privacy" className="text-[#C8F55A] underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
