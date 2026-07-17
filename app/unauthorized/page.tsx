export default function UnauthorizedPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-page)', color: 'var(--text-primary)', padding: '2rem' }}>
      <div style={{ maxWidth: 560, border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '2rem', background: 'var(--surface)' }}>
        <p style={{ letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Access denied</p>
        <h1 style={{ fontSize: '2rem', margin: '0.5rem 0 1rem', fontFamily: 'var(--font-instrument-serif)' }}>You do not have admin access.</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Sign in with a privileged account to access the admin area.
        </p>
      </div>
    </main>
  )
}
