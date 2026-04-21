"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { markFeatureUsed } from "@/lib/markFeatureUsed"

export default function DashboardEventsNewPage() {
  const router = useRouter()

  useEffect(() => {
    markFeatureUsed("create_event")
    router.replace("/create")
  }, [router])

  return null
}
