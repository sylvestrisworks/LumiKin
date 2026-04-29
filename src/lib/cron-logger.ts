import { db } from '@/lib/db'
import { cronRuns } from '@/lib/db/schema'

export type CronResult = {
  itemsProcessed: number
  itemsSkipped?:  number
  errors:         number
  meta?:          Record<string, unknown>
}

export async function logCronRun(
  jobName:   string,
  startedAt: Date,
  result:    CronResult,
): Promise<void> {
  try {
    const finishedAt = new Date()
    const status =
      result.errors > 0 && result.itemsProcessed === 0 ? 'error'   :
      result.errors > 0                                 ? 'partial' :
                                                          'success'
    await db.insert(cronRuns).values({
      jobName,
      startedAt,
      finishedAt,
      status,
      itemsProcessed: result.itemsProcessed,
      itemsSkipped:   result.itemsSkipped ?? 0,
      errors:         result.errors,
      durationMs:     finishedAt.getTime() - startedAt.getTime(),
      meta:           result.meta ?? null,
    })
  } catch (err) {
    console.error('[cron-logger] Failed to write run record:', err)
  }
}
