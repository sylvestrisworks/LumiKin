import { ImageResponse } from 'next/og'
import { NextResponse } from 'next/server'
import { rateLimit, getIp } from '@/lib/rate-limit'

export const runtime = 'edge'

export async function GET(req: Request) {
  if (!rateLimit(`og-partners:${getIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '1200px',
          height: '630px',
          background: '#09090b',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
        }}
      >
        {/* Top: wordmark + "for Business" badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              color: 'white',
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '-0.5px',
            }}
          >
            LumiKin
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '999px',
              color: '#a1a1aa',
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              padding: '4px 14px',
              textTransform: 'uppercase',
            }}
          >
            for Partners
          </div>
        </div>

        {/* Middle: headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              color: 'white',
              fontSize: '62px',
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '-1.5px',
              maxWidth: '880px',
            }}
          >
            Child-safety game ratings API
          </div>
          <div
            style={{
              color: '#71717a',
              fontSize: '24px',
              fontWeight: 400,
              lineHeight: 1.4,
              maxWidth: '760px',
            }}
          >
            Structured, versioned ratings for every game — including UGC platforms.
          </div>
        </div>

        {/* Bottom: stat chips + domain */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            {['Parental controls', 'ISPs', 'App stores', 'Education'].map((label) => (
              <div
                key={label}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#a1a1aa',
                  fontSize: '14px',
                  fontWeight: 500,
                  padding: '6px 14px',
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div style={{ color: '#3f3f46', fontSize: '16px', fontWeight: 500 }}>
            lumikin.org/partners
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
