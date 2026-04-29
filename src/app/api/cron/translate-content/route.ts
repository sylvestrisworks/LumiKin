import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, gameScores, reviews, gameTranslations } from '@/lib/db/schema'
import { eq, and, isNotNull, sql } from 'drizzle-orm'
import { callGeminiText } from '@/lib/vertex-ai'
import { logCronRun } from '@/lib/cron-logger'

export const maxDuration = 300

const LOCALES = ['sv', 'de', 'fr', 'es'] as const
type Locale = typeof LOCALES[number]

const LANGUAGE_NAMES: Record<Locale, string> = {
  sv: 'Swedish',
  de: 'German',
  fr: 'French',
  es: 'Spanish (Latin American)',
}

// 25 games × 4 parallel locale calls × ~5s each ≈ 125s — leaves ample margin inside the 300s wall.
const MAX_GAMES_PER_RUN = 25
const BUDGET_MS         = 220_000

// ─── Types ────────────────────────────────────────────────────────────────────

type TranslatableContent = {
  executiveSummary:  string | null
  benefitsNarrative: string | null
  risksNarrative:    string | null
  parentTip:         string | null
  parentTipBenefits: string | null
  bechdelNotes:      string | null
}

type TranslationResult = TranslatableContent

// ─── Bedrock translator ───────────────────────────────────────────────────────

async function translateToLocale(
  content: TranslatableContent,
  locale: Locale,
  attempt = 0
): Promise<TranslationResult | null> {
  const toTranslate: Partial<TranslatableContent> = {}
  for (const [k, v] of Object.entries(content)) {
    if (v && v.trim()) toTranslate[k as keyof TranslatableContent] = v
  }
  if (Object.keys(toTranslate).length === 0) return null

  const prompt = `Translate the following game review content from English to ${LANGUAGE_NAMES[locale]}.

Rules:
- Return ONLY a valid JSON object with the same keys as the input
- Keep the parent-friendly, informative tone
- Do NOT translate game titles, character names, brand names, or developer/publisher names — keep those exactly as-is
- Do not add explanations or markdown — just the JSON object

Input:
${JSON.stringify(toTranslate, null, 2)}`

  try {
    const text      = await callGeminiText(prompt)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error(`[translate] No JSON in response for ${locale}:`, text.slice(0, 200))
      return null
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<TranslationResult>
    return {
      executiveSummary:  parsed.executiveSummary  ?? null,
      benefitsNarrative: parsed.benefitsNarrative ?? null,
      risksNarrative:    parsed.risksNarrative    ?? null,
      parentTip:         parsed.parentTip         ?? null,
      parentTipBenefits: parsed.parentTipBenefits ?? null,
      bechdelNotes:      parsed.bechdelNotes      ?? null,
    }
  } catch (err) {
    console.error(`[translate] Error for locale ${locale}:`, err)
    return null
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('Authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.GOOGLE_CREDENTIALS_JSON) {
    return NextResponse.json({ error: 'GOOGLE_CREDENTIALS_JSON not set' }, { status: 500 })
  }

  const runStartedAt = new Date()
  const startedAt = Date.now()
  let translated = 0
  let skipped = 0
  let errors = 0

  // Fetch games that are missing at least one locale translation.
  // Outer loop is now games (not locales) so all locales run in parallel per game,
  // giving each locale equal throughput instead of sv exhausting the time budget.
  const pending = await db
    .select({
      gameId:           games.id,
      slug:             games.slug,
      executiveSummary: gameScores.executiveSummary,
      reviewId:         gameScores.reviewId,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      isNotNull(gameScores.curascore),
      sql`(
        SELECT COUNT(*) FROM game_translations gt
        WHERE gt.game_id = ${games.id}
          AND gt.locale = ANY(ARRAY['sv','de','fr','es'])
      ) < 4`
    ))
    .orderBy(gameScores.curascore)
    .limit(MAX_GAMES_PER_RUN)

  for (const row of pending) {
    if (Date.now() - startedAt > BUDGET_MS) {
      console.log(`[translate] Budget reached after ${translated} translations`)
      break
    }

    // Which locales does this game already have?
    const done = await db
      .select({ locale: gameTranslations.locale })
      .from(gameTranslations)
      .where(and(
        eq(gameTranslations.gameId, row.gameId),
        sql`${gameTranslations.locale} = ANY(ARRAY['sv','de','fr','es'])`
      ))
    const doneSet = new Set(done.map(r => r.locale))
    const missing = LOCALES.filter(l => !doneSet.has(l))

    if (missing.length === 0) { skipped++; continue }

    // Fetch review narratives once, shared across all locale calls
    let content: TranslatableContent = {
      executiveSummary:  row.executiveSummary,
      benefitsNarrative: null,
      risksNarrative:    null,
      parentTip:         null,
      parentTipBenefits: null,
      bechdelNotes:      null,
    }

    if (row.reviewId) {
      const [review] = await db
        .select({
          benefitsNarrative: reviews.benefitsNarrative,
          risksNarrative:    reviews.risksNarrative,
          parentTip:         reviews.parentTip,
          parentTipBenefits: reviews.parentTipBenefits,
          bechdelNotes:      reviews.bechdelNotes,
        })
        .from(reviews)
        .where(eq(reviews.id, row.reviewId))
        .limit(1)
      if (review) content = { ...content, ...review }
    }

    const hasContent = Object.values(content).some(v => v && v.trim())
    if (!hasContent) {
      // Nothing to translate — mark all missing locales as done so we skip next time
      await Promise.all(missing.map(locale =>
        db.insert(gameTranslations).values({ gameId: row.gameId, locale }).onConflictDoNothing()
      ))
      skipped += missing.length
      continue
    }

    // Translate all missing locales in parallel
    console.log(`[translate] ${row.slug} → ${missing.join(', ')}`)
    const results = await Promise.all(
      missing.map(async locale => ({ locale, result: await translateToLocale(content, locale) }))
    )

    for (const { locale, result } of results) {
      if (!result) { errors++; continue }
      await db.insert(gameTranslations).values({
        gameId:            row.gameId,
        locale,
        executiveSummary:  result.executiveSummary,
        benefitsNarrative: result.benefitsNarrative,
        risksNarrative:    result.risksNarrative,
        parentTip:         result.parentTip,
        parentTipBenefits: result.parentTipBenefits,
        bechdelNotes:      result.bechdelNotes,
      }).onConflictDoNothing()
      translated++
    }
  }

  await logCronRun('translate-content', runStartedAt, {
    itemsProcessed: translated,
    itemsSkipped:   skipped,
    errors,
  })
  return NextResponse.json({
    ok: true,
    translated,
    skipped,
    errors,
    elapsedMs: Date.now() - startedAt,
  })
}
