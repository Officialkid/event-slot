"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import type { CSSProperties } from "react"

interface SmartCTAProps {
  style?: CSSProperties
  className?: string
  children: React.ReactNode
}

/** Sends signed-in users to /dashboard, everyone else to /signup */
export default function SmartCTA({ style, className, children }: SmartCTAProps) {
  const { data: session } = useSession()
  const href = session ? "/dashboard" : "/signup"
  return (
    <Link href={href} style={style} className={className}>
      {children}
    </Link>
  )
}
