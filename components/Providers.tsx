'use client'

import { SessionProvider } from 'next-auth/react'
import CountryCapture from './CountryCapture'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CountryCapture />
      {children}
    </SessionProvider>
  )
}
