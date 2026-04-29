import { NextResponse } from 'next/server'
import { logCronRun } from '@/lib/cron-logger'

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('Authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    jobName:        string
    startedAt:      string
    itemsProcessed: number
    itemsSkipped?:  number
    errors:         number
    meta?:          Record<string, unknown>
  }

  await logCronRun(body.jobName, new Date(body.startedAt), {
    itemsProcessed: body.itemsProcessed,
    itemsSkipped:   body.itemsSkipped,
    errors:         body.errors,
    meta:           body.meta,
  })

  return NextResponse.json({ ok: true })
}
