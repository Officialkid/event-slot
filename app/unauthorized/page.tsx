export default function UnauthorizedPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#080808', color: '#F0EDE6', padding: '2rem' }}>
      <div style={{ maxWidth: 560, border: '1px solid rgba(240,237,230,0.08)', borderRadius: 20, padding: '2rem', background: '#111' }}>
        <p style={{ letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.5)', fontSize: '0.75rem' }}>Access denied</p>
        <h1 style={{ fontSize: '2rem', margin: '0.5rem 0 1rem', fontFamily: 'var(--font-instrument-serif)' }}>You do not have admin access.</h1>
        <p style={{ color: 'rgba(240,237,230,0.72)', lineHeight: 1.6 }}>
          Sign in with a privileged account to access the admin area.
        </p>
      </div>
    </main>
  )
}