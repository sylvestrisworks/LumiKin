import { ImageResponse } from 'next/og'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { rateLimit, getIp } from '@/lib/rate-limit'

type Config = {
  name: string
  accentBg: string    // dark shade for gradient
  accentColor: string // bright shade for icon bg
}

const PLATFORMS: Record<string, Config> = {
  playstation:     { name: 'PlayStation',     accentBg: '#172554', accentColor: '#1d4ed8' },
  xbox:            { name: 'Xbox',            accentBg: '#052e16', accentColor: '#15803d' },
  'nintendo-switch': { name: 'Nintendo Switch', accentBg: '#450a0a', accentColor: '#dc2626' },
  ios:             { name: 'iOS',             accentBg: '#082f49', accentColor: '#0284c7' },
  android:         { name: 'Android',         accentBg: '#022c22', accentColor: '#059669' },
  pc:              { name: 'PC',              accentBg: '#2e1065', accentColor: '#7c3aed' },
}

const FALLBACK = (
  <div style={{ display: 'flex', width: '1200px', height: '630px', background: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ color: 'white', fontSize: '48px', fontWeight: 700 }}>LumiKin</div>
  </div>
)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!rateLimit(`og-platform:${getIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { slug } = await params
  const config = PLATFORMS[slug]
  if (!config) return new ImageResponse(FALLBACK, { width: 1200, height: 630 })

  let count = 0
  let avgScore: number | null = null

  try {
    const keyword = config.name === 'Nintendo Switch' ? 'Nintendo Switch'
      : config.name === 'iOS' ? 'iOS'
      : config.name
    const platformFilter = sql`${games.platforms}::text ILIKE ${'%' + keyword + '%'}`
    const [row] = await db
      .select({
        count:    sql<number>`count(${gameScores.id})::int`,
        avgScore: sql<number>`round(avg(${gameScores.curascore}))::int`,
      })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(and(isNotNull(gameScores.curascore), platformFilter))
    count    = Number(row?.count ?? 0)
    avgScore = row?.avgScore ?? null
  } catch {
    // render without stats on DB error
  }

  const initials = config.name.slice(0, 2).toUpperCase()

  try {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '1200px',
            height: '630px',
            background: '#0f172a',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle accent gradient from top-left */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '600px',
            height: '630px',
            background: `linear-gradient(135deg, ${config.accentBg}cc 0%, transparent 70%)`,
            display: 'flex',
          }} />

          {/* Content */}
          <div style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '60px 72px',
            width: '100%',
          }}>

            {/* Top: branding */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: '#6366f1',
                borderRadius: '10px',
                padding: '6px 14px',
                color: 'white',
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '-0.3px',
              }}>
                LumiKin
              </div>
              <div style={{ color: '#94a3b8', fontSize: '16px' }}>for parents</div>
            </div>

            {/* Middle: platform identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
              {/* Icon */}
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '28px',
                background: config.accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 0 40px ${config.accentColor}66`,
              }}>
                <span style={{ color: 'white', fontSize: '52px', fontWeight: 900 }}>{initials}</span>
              </div>

              {/* Name + tagline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.6)',
                  borderRadius: '999px',
                  padding: '4px 14px',
                  fontSize: '15px',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  width: 'fit-content',
                }}>
                  Platform
                </span>
                <div style={{
                  color: 'white',
                  fontSize: config.name.length > 12 ? '62px' : '76px',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-2px',
                }}>
                  {config.name}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '22px' }}>
                  Safety scores for families
                </div>
              </div>
            </div>

            {/* Bottom: stats + domain */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                {count > 0 && (
                  <div style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '14px',
                    padding: '10px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                  }}>
                    <span style={{ color: 'white', fontSize: '28px', fontWeight: 800 }}>{count}</span>
                    <span style={{ color: '#64748b', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>games rated</span>
                  </div>
                )}
                {avgScore != null && (
                  <div style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '14px',
                    padding: '10px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                  }}>
                    <span style={{ color: 'white', fontSize: '28px', fontWeight: 800 }}>{avgScore}</span>
                    <span style={{ color: '#64748b', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>avg lumiscore</span>
                  </div>
                )}
              </div>
              <div style={{ color: '#334155', fontSize: '16px' }}>lumikin.org</div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    )
  } catch (err) {
    console.error('[og/platform] ImageResponse error:', err)
    return new ImageResponse(FALLBACK, { width: 1200, height: 630 })
  }
}
