"use client"

import { signOut } from "next-auth/react"

type SignOutAndContinueButtonProps = {
  callbackUrl: string
}

export default function SignOutAndContinueButton({
  callbackUrl,
}: SignOutAndContinueButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl })}
      style={{
        display: "inline-block",
        background: "var(--accent)",
        color: "#0A0A0A",
        borderRadius: 8,
        padding: "0.7rem 1.35rem",
        fontSize: "0.9rem",
        fontWeight: 600,
        fontFamily: "var(--font-dm-sans)",
        textDecoration: "none",
        border: "none",
        cursor: "pointer",
      }}
    >
      Sign out and continue
    </button>
  )
}
