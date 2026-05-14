import React from 'react'
import type { DocsThemeConfig } from 'nextra-theme-docs'
import { BookMarked, Compass, Github } from 'lucide-react'

const config: DocsThemeConfig = {
  logo: (
    <span style={{ fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Compass style={{ width: '1.1rem', height: '1.1rem', color: '#C8F55A' }} aria-hidden="true" />
      <span>
        <span style={{ color: '#FFFFFF' }}>Event</span>
        <span style={{ color: '#C8F55A' }}>Slot</span>
      </span>
    </span>
  ),
  project: {
    link: 'https://github.com/Officialkid/event-slot',
    icon: <Github style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />,
  },
  docsRepositoryBase: 'https://github.com/Officialkid/event-slot/tree/main/docs-site/pages',
  chat: {
    link: 'https://www.eventslot.co',
    icon: <BookMarked style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />,
  },
  darkMode: false,
  nextThemes: {
    defaultTheme: 'dark',
    forcedTheme: 'dark',
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    autoCollapse: true,
  },
  toc: {
    backToTop: true,
  },
  search: {
    placeholder: 'Search EventSlot docs...',
  },
  editLink: {
    content: 'Edit this page on GitHub →',
  },
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback',
  },
  head: (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>EventSlot Docs - Smart Event Registration &amp; Waitlist Management</title>
      <meta name="description" content="Official documentation for EventSlot - the smart event registration and waitlist management platform built for Africa. Learn how to create events, manage waitlists, and grow your organiser community." />
      <meta name="keywords" content="event registration Kenya, waitlist management, EventSlot, event platform Africa" />
      <meta name="robots" content="index, follow" />
      <meta name="author" content="EventSlot Team" />
      
      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://docs.eventsslot.com" />
      <meta property="og:title" content="EventSlot Docs - Smart Event Registration Platform" />
      <meta property="og:description" content="Everything you need to create events, manage waitlists, and grow with EventSlot." />
      <meta property="og:image" content="https://www.eventsslot.com/og-image.png" />
      <meta property="og:site_name" content="EventSlot" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="EventSlot Docs" />
      <meta name="twitter:description" content="Official documentation for EventSlot - smart event registration for Africa." />
      <meta name="twitter:image" content="https://www.eventsslot.com/og-image.png" />
      
      {/* Canonical */}
      <link rel="canonical" href="https://docs.eventsslot.com" />
      
      {/* Favicon */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      
      {/* Google Search Console verification (add your verification code) */}
      {/* <meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" /> */}
    </>
  ),
  footer: {
    content: (
      <span>
        © {new Date().getFullYear()} EventSlot —{' '}
        <em>Smarter Events. Better Experiences.</em>
      </span>
    ),
  },
}

export default config
