import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '6rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: '5rem',
          fontWeight: 400,
          color: 'rgba(240,237,230,0.08)',
          margin: '0 0 1rem',
          lineHeight: 1,
        }}
      >
        404
      </p>
      <h1
        style={{
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: '1.6rem',
          fontWeight: 400,
          color: '#F0EDE6',
          margin: '0 0 0.75rem',
        }}
      >
        Page not found
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-dm-sans)',
          fontWeight: 300,
          fontSize: '0.9rem',
          color: 'rgba(240,237,230,0.45)',
          margin: '0 0 2.5rem',
          lineHeight: 1.6,
        }}
      >
        The page you are looking for does not exist or has been moved.
      </p>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#C8F55A',
            color: '#0A0A0A',
            borderRadius: 100,
            padding: '0.72rem 1.4rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            fontFamily: 'var(--font-dm-sans)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Back to home
        </Link>
        <Link
          href="/create"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'transparent',
            color: '#F0EDE6',
            border: '0.5px solid rgba(240,237,230,0.2)',
            borderRadius: 100,
            padding: '0.72rem 1.4rem',
            fontSize: '0.9rem',
            fontWeight: 400,
            fontFamily: 'var(--font-dm-sans)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Create an event
        </Link>
      </div>
    </div>
  )
}
