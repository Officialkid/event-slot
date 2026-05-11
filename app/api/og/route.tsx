import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const title = searchParams.get('title') ?? 'Event Registration'
  const organizer = searchParams.get('organizer') ?? ''
  const spots = searchParams.get('spots') ?? ''

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0A0A',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px',
        }}
      >
        <div style={{ color: '#C8F55A', fontSize: 18, marginBottom: 16 }}>
          EventSlot
        </div>
        <div
          style={{
            color: '#F0EDE6',
            fontSize: 52,
            fontWeight: 600,
            lineHeight: 1.2,
            marginBottom: 20,
          }}
        >
          {title}
        </div>
        {organizer && (
          <div style={{ color: 'rgba(240,237,230,0.5)', fontSize: 22 }}>
            Organised by {organizer}
          </div>
        )}
        {spots && (
          <div style={{ color: '#C8F55A', fontSize: 20, marginTop: 12 }}>
            {spots} spots available
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
