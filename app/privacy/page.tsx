export default function PrivacyPage() {
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
        Privacy Policy
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

      <Section title="What we collect">
        When you create an account, we store your name and email address.
        When you register for an event, we store the answers you submit.
        We do not sell your data to anyone.
      </Section>

      <Section title="How we use it">
        We use your email to send registration confirmations and slot notifications.
        Organizers can see the registration data for their own events only.
      </Section>

      <Section title="Third parties">
        We use Google for sign in (Google OAuth).
        We use Resend to send transactional emails.
        We use Neon to store data securely.
      </Section>

      <Section title="Your rights">
        You can request deletion of your account and data by emailing{' '}
        <a
          href="mailto:hello@eventslot.app"
          style={{ color: 'rgba(240,237,230,0.6)', textDecoration: 'underline' }}
        >
          hello@eventslot.app
        </a>
        .
      </Section>

      <Section title="Contact">
        <a
          href="mailto:hello@eventslot.app"
          style={{ color: 'rgba(240,237,230,0.6)', textDecoration: 'underline' }}
        >
          hello@eventslot.app
        </a>
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
