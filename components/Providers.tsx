'use client'

import { SessionProvider } from 'next-auth/react'
import CountryCapture from './CountryCapture'
import AssistantWidget from './AssistantWidget'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CountryCapture />
      {children}
      <AssistantWidget />
    </SessionProvider>
  )
}
