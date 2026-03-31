"use client"

import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useEffect } from "react"

export default function OldDashboardRedirect() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const slug = params?.slug as string
  const token = searchParams?.get("token")

  useEffect(() => {
    if (slug) {
      const dest = `/dashboard/events/${slug}${token ? `?token=${encodeURIComponent(token)}` : ""}`
      router.replace(dest)
    }
  }, [slug, token, router])

  return null
}