import { ImageResponse } from 'next/og'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'edge'

function curascoreColor(score: number) {
  if (score >= 70) return '#059669' // emerald
  if (score >= 50) return '#d97706' // amber
  return '#dc2626' // red
}

function timeLabel(mins: number | null) {
  if (!mins) return null
  if (mins >= 120) return '120 min/day'
  if (mins >= 90)  return '90 min/day'
  if (mins >= 60)  return '60 min/day'
  if (mins >= 30)  return '30 min/day'
  return '15 min/day'
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const [row] = await db
    .select({
      title:           games.title,
      backgroundImage: games.backgroundImage,
      esrbRating:      games.esrbRating,
      genres:          games.genres,
      curascore:       gameScores.curascore,
      timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
      timeRecommendationColor:   gameScores.timeRecommendationColor,
    })
    .from(games)
    .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(eq(games.slug, slug))
    .limit(1)

  const title      = row?.title ?? 'Unknown Game'
  const bgImage    = row?.backgroundImage ?? null
  const curascore  = row?.curascore ?? null
  const esrb       = row?.esrbRating ?? null
  const genre      = (row?.genres as string[] | null)?.[0] ?? null
  const timeMins   = row?.timeRecommendationMinutes ?? null
  const timeColor  = row?.timeRecommendationColor ?? 'green'

  const timeBg = timeColor === 'green' ? '#d1fae5' : timeColor === 'amber' ? '#fef3c7' : '#fee2e2'
  const timeFg = timeColor === 'green' ? '#065f46' : timeColor === 'amber' ? '#92400e' : '#991b1b'

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
        {/* Background image with dark overlay */}
        {bgImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgImage}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.25,
            }}
          />
        )}

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.7) 100%)',
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
              PlaySmart
            </div>
            <div style={{ color: '#94a3b8', fontSize: '16px' }}>for parents</div>
          </div>

          {/* Middle: title + meta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(genre || esrb) && (
              <div style={{ display: 'flex', gap: '12px' }}>
                {genre && (
                  <span style={{
                    background: 'rgba(99,102,241,0.2)',
                    border: '1px solid rgba(99,102,241,0.4)',
                    color: '#a5b4fc',
                    borderRadius: '999px',
                    padding: '4px 14px',
                    fontSize: '16px',
                  }}>{genre}</span>
                )}
                {esrb && (
                  <span style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#cbd5e1',
                    borderRadius: '999px',
                    padding: '4px 14px',
                    fontSize: '16px',
                  }}>{esrb}</span>
                )}
              </div>
            )}
            <div style={{
              color: 'white',
              fontSize: title.length > 30 ? '52px' : '64px',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-1px',
            }}>
              {title}
            </div>
          </div>

          {/* Bottom: score + time */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            {curascore != null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    fontSize: '88px',
                    fontWeight: 900,
                    color: curascoreColor(curascore),
                    lineHeight: 1,
                  }}>
                    {curascore}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '16px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    Curascore
                  </div>
                </div>

                {timeMins && (
                  <div style={{
                    background: timeBg,
                    borderRadius: '14px',
                    padding: '12px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: timeFg }}>{timeLabel(timeMins)}</div>
                    <div style={{ fontSize: '13px', color: timeFg, opacity: 0.7, marginTop: '2px' }}>recommended</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#475569', fontSize: '24px' }}>Not yet scored</div>
            )}

            <div style={{ color: '#334155', fontSize: '15px' }}>curascore.vercel.app</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
