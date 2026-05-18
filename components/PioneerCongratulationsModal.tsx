"use client"

import { useEffect, useState } from "react"

export function PioneerCongratulationsModal() {
  const [show, setShow] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    fetch("/api/user/pioneer-status")
      .then((r) => r.json())
      .then((data: { showCongratulations?: boolean }) => {
        if (data.showCongratulations) setShow(true)
      })
      .catch(() => {})
  }, [])

  async function dismiss() {
    setClosing(true)
    try {
      await fetch("/api/user/pioneer-status", { method: "POST" })
    } finally {
      window.setTimeout(() => setShow(false), 300)
    }
  }

  if (!show) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm transition-opacity duration-300 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl border border-[#C8F55A]/40 bg-[#141414] p-8 text-center transition-transform duration-300 ${
          closing ? "scale-95" : "scale-100"
        }`}
      >
        <div className="absolute left-1/2 top-0 h-1 w-32 -translate-x-1/2 rounded-full bg-[#C8F55A] blur-sm" />

        <div className="mx-auto mb-5 mt-2 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#C8F55A]/40 bg-[#C8F55A]/10">
          <span className="text-4xl">🏆</span>
        </div>

        <h2 className="mb-2 text-2xl font-bold leading-tight text-white">
          Congratulations!
          <br />
          <span className="text-[#C8F55A]">You&apos;re an EventSlot Pioneer.</span>
        </h2>

        <p className="mb-6 text-sm leading-relaxed text-[#A3A3A3]">
          You signed up for EventSlot early - before most people knew what it would become. That matters to us. The
          Pioneer badge is awarded to a limited group of our earliest supporters. <span className="font-medium text-white">You&apos;re in it.</span>
        </p>

        <div className="my-5 border-t border-[#2A2A2A]" />

        <div className="mb-6 rounded-xl border border-[#C8F55A]/20 bg-[#C8F55A]/10 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#C8F55A]">A gift from us</p>
          <p className="text-sm leading-relaxed text-white">
            Invite 2 people to EventSlot. When both create their first event, your next AI event report is{" "}
            <span className="font-bold text-[#C8F55A]">completely free</span> - on us. No payment needed.
          </p>
          <p className="mt-2 text-xs text-[#525252]">Each referral earns you tokens. 20 tokens = 1 free report.</p>
        </div>

        <div className="space-y-3">
          <a
            href="/dashboard/community"
            onClick={dismiss}
            className="block w-full rounded-xl bg-[#C8F55A] py-3 text-sm font-bold text-black transition-colors hover:bg-[#b8e040]"
          >
            View My Pioneer Badge &amp; Invite Friends
          </a>
          <button onClick={dismiss} className="block w-full py-2 text-sm text-[#525252] transition-colors hover:text-[#A3A3A3]">
            Continue to Dashboard
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 border-t border-[#2A2A2A] pt-4">
          <span className="text-[#C8F55A]">🏆</span>
          <span className="text-xs text-[#525252]">EventSlot Pioneer - Limited Badge</span>
        </div>
      </div>
    </div>
  )
}
