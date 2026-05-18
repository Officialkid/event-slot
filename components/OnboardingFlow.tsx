"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Step = 1 | 2 | 3

type OnboardingPayload = {
  onboardingCompleted?: boolean
  onboardingStep?: number
}

export function OnboardingFlow() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/user/onboarding")
      .then((r) => r.json())
      .then((data: OnboardingPayload) => {
        if (!data.onboardingCompleted) {
          const initialStep = data.onboardingStep && data.onboardingStep >= 1 && data.onboardingStep <= 3
            ? (data.onboardingStep as Step)
            : 1
          setStep(initialStep)
          setShow(true)
        }
      })
      .catch(() => {})
  }, [])

  async function advance(nextStep: Step | "complete") {
    const value = nextStep === "complete" ? 3 : nextStep

    await fetch("/api/user/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: value }),
    }).catch(() => {})

    if (nextStep === "complete") {
      setShow(false)
      return
    }

    setStep(nextStep)
  }

  async function goCreateEvent() {
    await advance("complete")
    router.push("/dashboard/events/new")
  }

  async function goInvite() {
    await advance("complete")
    router.push("/dashboard/community")
  }

  async function skip() {
    await advance("complete")
  }

  const progressWidth = useMemo(() => `${(step / 3) * 100}%`, [step])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden">
        <div className="h-1 bg-[#2A2A2A]">
          <div className="h-1 bg-[#C8F55A] transition-all duration-500" style={{ width: progressWidth }} />
        </div>

        <div className="p-8">
          <p className="text-[#525252] text-xs mb-6">Step {step} of 3</p>

          {step === 1 && (
            <>
              <div className="w-14 h-14 rounded-full bg-[#C8F55A]/10 border-2 border-[#C8F55A]/30 flex items-center justify-center mb-5">
                <span className="text-lg font-bold text-[#C8F55A]">1</span>
              </div>
              <h2 className="text-white font-bold text-xl mb-3">Welcome to EventSlot</h2>
              <p className="text-[#A3A3A3] text-sm leading-relaxed mb-6">
                You are in. EventSlot helps you create events, manage registrations, and handle waitlists automatically.
                Let us get you set up in under 2 minutes.
              </p>
              <button
                onClick={() => advance(2)}
                className="w-full bg-[#C8F55A] text-black font-bold py-3 rounded-xl hover:bg-[#b8e040] transition-colors"
              >
                Let&apos;s go
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="w-14 h-14 rounded-full bg-[#C8F55A]/10 border-2 border-[#C8F55A]/30 flex items-center justify-center mb-5">
                <span className="text-lg font-bold text-[#C8F55A]">2</span>
              </div>
              <h2 className="text-white font-bold text-xl mb-3">Create your first event</h2>
              <p className="text-[#A3A3A3] text-sm leading-relaxed mb-4">
                Publish your event in under 5 minutes. Set a date, location, and capacity. Your registration link is
                generated automatically and ready to share.
              </p>

              <div className="bg-[#C8F55A]/10 border border-[#C8F55A]/20 rounded-xl p-4 mb-6">
                <p className="text-[#C8F55A] text-xs font-semibold mb-1">Your first event report is on us</p>
                <p className="text-[#A3A3A3] text-xs leading-relaxed">
                  When your first event ends, we will give you 20 free tokens so you can download the full AI-powered
                  event report, completely free, just this once.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={goCreateEvent}
                  className="w-full bg-[#C8F55A] text-black font-bold py-3 rounded-xl hover:bg-[#b8e040] transition-colors"
                >
                  Create my first event
                </button>
                <button
                  onClick={() => advance(3)}
                  className="w-full text-[#525252] text-sm py-2 hover:text-[#A3A3A3] transition-colors"
                >
                  I&apos;ll do this later
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="w-14 h-14 rounded-full bg-[#C8F55A]/10 border-2 border-[#C8F55A]/30 flex items-center justify-center mb-5">
                <span className="text-lg font-bold text-[#C8F55A]">3</span>
              </div>
              <h2 className="text-white font-bold text-xl mb-3">Invite a friend, earn tokens</h2>
              <p className="text-[#A3A3A3] text-sm leading-relaxed mb-4">
                Know someone who organizes events? Invite them to EventSlot. When they sign up, you earn 5 tokens.
                When they create their first event, you earn 5 more.
              </p>
              <div className="bg-[#C8F55A]/10 border border-[#C8F55A]/20 rounded-xl p-4 mb-6">
                <p className="text-[#C8F55A] text-xs font-semibold mb-1">Invite 2 people who create events</p>
                <p className="text-[#A3A3A3] text-xs">You will earn 20 tokens, enough for a free AI report.</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={goInvite}
                  className="w-full bg-[#C8F55A] text-black font-bold py-3 rounded-xl hover:bg-[#b8e040] transition-colors"
                >
                  Get my referral link
                </button>
                <button
                  onClick={skip}
                  className="w-full text-[#525252] text-sm py-2 hover:text-[#A3A3A3] transition-colors"
                >
                  Maybe later - go to dashboard
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
