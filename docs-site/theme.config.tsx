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
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="EventSlot Docs" />
      <meta property="og:description" content="Smart event registration & waitlist management platform documentation." />
      <link rel="icon" href="/favicon.ico" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
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
