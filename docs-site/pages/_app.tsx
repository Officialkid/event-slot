import type { AppProps } from 'next/app'
import { DM_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import 'nextra-theme-docs/style.css'
import '../styles/globals.css'

const body = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const display = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-display',
  weight: '400',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${body.variable} ${display.variable} ${mono.variable} bg-bg text-text antialiased`}>
      <Component {...pageProps} />
    </div>
  )
}
