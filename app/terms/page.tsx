export default function TermsPage() {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '3rem 1.5rem',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: '1.8rem',
          fontWeight: 400,
          color: '#F0EDE6',
          margin: '0 0 0.5rem',
        }}
      >
        Terms of Use
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-dm-sans)',
          fontWeight: 300,
          fontSize: '0.85rem',
          color: 'rgba(240,237,230,0.35)',
          margin: '0 0 2.5rem',
        }}
      >
        Last updated: March 2026
      </p>

      <Section title="Using EventSlot">
        EventSlot is free to use. We provide the platform as-is, without warranty of any kind.
        We do not guarantee uptime, data retention, or fitness for any particular purpose.
      </Section>

      <Section title="Organizer responsibility">
        Organizers are solely responsible for the content of their events, including descriptions,
        questions, and any communications with attendees. EventSlot is not liable for any event
        content created by organizers.
      </Section>

      <Section title="Prohibited use">
        You may not use EventSlot to send spam, create fake or misleading events, or engage in
        any activity that violates applicable law or harms other users.
      </Section>

      <Section title="Changes">
        We may update these terms at any time. Continued use of EventSlot after changes are
        posted constitutes acceptance of the updated terms.
      </Section>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2
        style={{
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: '1.15rem',
          fontWeight: 400,
          color: '#F0EDE6',
          margin: '0 0 0.6rem',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-dm-sans)',
          fontWeight: 300,
          fontSize: '0.9rem',
          color: 'rgba(240,237,230,0.55)',
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {children}
      </p>
    </div>
  )
}
