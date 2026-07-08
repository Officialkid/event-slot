"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

export default function CountryCapture() {
  const { data: session, status } = useSession()
  const [capturedIdentity, setCapturedIdentity] = useState<string | null>(null)

  useEffect(() => {
    if (status !== "authenticated") return

    const identity = session?.user?.id ?? session?.user?.email ?? "authenticated-user"
    if (capturedIdentity === identity) return

    fetch("/api/user/country", { cache: "no-store" })
      .catch(() => {})
      .finally(() => setCapturedIdentity(identity))
  }, [capturedIdentity, session?.user?.email, session?.user?.id, status])

  return null
}
