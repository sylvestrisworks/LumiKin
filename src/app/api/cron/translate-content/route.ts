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

// 150 games in batches of 15 × 1 multi-locale call (~8s) ≈ 80s — well inside the 300s wall.
const MAX_GAMES_PER_RUN = 150
const BATCH_SIZE        = 15
const BUDGET_MS         = 260_000

// ─── Types ────────────────────────────────────────────────────────────────────

type TranslatableContent = {
  executiveSummary:  string | null
  benefitsNarrative: string | null
  risksNarrative:    string | null
  parentTip:         string | null
  parentTipBenefits: string | null
  bechdelNotes:      string | null
  timeRecommendationReasoning: string | null
}

type TranslationResult = TranslatableContent

// ─── Translator — all missing locales in one Gemini call ─────────────────────

async function translateToLocales(
  content: TranslatableContent,
  locales: Locale[],
  dntTerms: string[] = [],
): Promise<Partial<Record<Locale, TranslationResult>>> {
  const toTranslate: Partial<TranslatableContent> = {}
  for (const [k, v] of Object.entries(content)) {
    if (v && v.trim()) toTranslate[k as keyof TranslatableContent] = v
  }
  if (Object.keys(toTranslate).length === 0) return {}

  const localeList = locales.map(l => LANGUAGE_NAMES[l]).join(', ')
  const localeKeys = locales.map(l => `"${l}"`).join(', ')

  const dntBlock = dntTerms.length > 0
    ? `\nDO NOT TRANSLATE these terms — they MUST appear verbatim in the translation if they appear in the source:\n${dntTerms.map(t => `  - ${t}`).join('\n')}\n`
    : ''

  const prompt = `You are translating game-review content from English into ${localeList} for parents. Faithfulness matters more than fluency — a less elegant but accurate translation beats a polished one that adds or drops information.

FORMAT:
- Return ONLY a valid JSON object with locale codes as top-level keys: ${localeKeys}
- Each value has the same keys as the input.
- No explanations or markdown around the JSON — just the JSON object.

CONTENT FIDELITY (most important):
- Translate what is there. Do NOT add information, advice, examples, clarifications, or sentences that are not in the English source.
- Do NOT summarize or compress. Translate every sentence in the source.
- Each translated field's length should be roughly 80–130% of the source field length. If a field is hard to translate concisely, stay close to source length rather than shortening.
- Keep the same number of sentences as the source (±1 is acceptable).
- Do NOT invent facts about gameplay, ratings, mechanics, or risks that are not stated in the source.
${dntBlock}
TONE:
- Parent-friendly and informative, never fear-based.
- Match the source register — if the source is plain language, do not get fancy in the translation.

Input:
${JSON.stringify(toTranslate, null, 2)}`

  try {
    const text = await callGeminiText(prompt)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[translate] No JSON in response:', text.slice(0, 200))
      return {}
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<Record<Locale, Partial<TranslationResult>>>
    const out: Partial<Record<Locale, TranslationResult>> = {}
    for (const locale of locales) {
      const r = parsed[locale]
      if (!r) continue
      out[locale] = {
        executiveSummary:            r.executiveSummary  ?? null,
        benefitsNarrative:           r.benefitsNarrative ?? null,
        risksNarrative:              r.risksNarrative    ?? null,
        parentTip:                   r.parentTip         ?? null,
        parentTipBenefits:           r.parentTipBenefits ?? null,
        bechdelNotes:                r.bechdelNotes      ?? null,
        timeRecommendationReasoning: r.timeRecommendationReasoning ?? null,
      }
    }
    return out
  } catch (err) {
    console.error('[translate] Error:', err)
    return {}
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

  // Fetch games that need any translation work — either missing locales or
  // existing rows flagged as needs_retranslate=true by scripts/audit-translations.ts.
  const pending = await db
    .select({
      gameId:                       games.id,
      slug:                         games.slug,
      title:                        games.title,
      developer:                    games.developer,
      publisher:                    games.publisher,
      executiveSummary:             gameScores.executiveSummary,
      timeRecommendationReasoning:  gameScores.timeRecommendationReasoning,
      reviewId:                     gameScores.reviewId,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      isNotNull(gameScores.curascore),
      sql`(
        (SELECT COUNT(*) FROM game_translations gt
           WHERE gt.game_id = ${games.id}
             AND gt.locale = ANY(ARRAY['sv','de','fr','es'])) < 4
        OR EXISTS (SELECT 1 FROM game_translations gt
           WHERE gt.game_id = ${games.id}
             AND gt.locale = ANY(ARRAY['sv','de','fr','es'])
             AND gt.needs_retranslate = TRUE)
      )`
    ))
    .orderBy(gameScores.curascore)
    .limit(MAX_GAMES_PER_RUN)

  let retranslated = 0

  const processGame = async (row: typeof pending[number]) => {
    const existing = await db
      .select({ locale: gameTranslations.locale, needsRetranslate: gameTranslations.needsRetranslate })
      .from(gameTranslations)
      .where(and(
        eq(gameTranslations.gameId, row.gameId),
        sql`${gameTranslations.locale} = ANY(ARRAY['sv','de','fr','es'])`
      ))
    const doneSet = new Set(existing.map(r => r.locale))
    const missing: Locale[]     = LOCALES.filter(l => !doneSet.has(l))
    const retranslate: Locale[] = existing
      .filter(r => r.needsRetranslate && LOCALES.includes(r.locale as Locale))
      .map(r => r.locale as Locale)

    const targets = Array.from(new Set([...missing, ...retranslate]))
    if (targets.length === 0) { skipped++; return }

    let content: TranslatableContent = {
      executiveSummary:            row.executiveSummary,
      timeRecommendationReasoning: row.timeRecommendationReasoning,
      benefitsNarrative:           null,
      risksNarrative:              null,
      parentTip:                   null,
      parentTipBenefits:           null,
      bechdelNotes:                null,
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
      // Reserve empty rows for the locales that are missing entirely; clear the
      // flag on any existing retranslate rows since there's nothing to translate.
      await Promise.all(missing.map(locale =>
        db.insert(gameTranslations).values({ gameId: row.gameId, locale }).onConflictDoNothing()
      ))
      if (retranslate.length > 0) {
        await db.update(gameTranslations)
          .set({ needsRetranslate: false, auditedAt: new Date() })
          .where(and(
            eq(gameTranslations.gameId, row.gameId),
            sql`${gameTranslations.locale} = ANY(${retranslate})`,
          ))
      }
      skipped += targets.length
      return
    }

    const label = [
      missing.length     ? `new ${missing.join(',')}` : null,
      retranslate.length ? `retry ${retranslate.join(',')}` : null,
    ].filter(Boolean).join(' | ')
    const dntTerms = [row.title, row.developer, row.publisher]
      .filter((s): s is string => !!s && s.trim().length > 0)

    console.log(`[translate] ${row.slug} → ${label}`)
    const results = await translateToLocales(content, targets, dntTerms)

    for (const locale of targets) {
      const result = results[locale]
      if (!result) { errors++; continue }
      const isRetranslate = retranslate.includes(locale)
      if (isRetranslate) {
        await db.update(gameTranslations)
          .set({
            executiveSummary:            result.executiveSummary,
            benefitsNarrative:           result.benefitsNarrative,
            risksNarrative:              result.risksNarrative,
            parentTip:                   result.parentTip,
            parentTipBenefits:           result.parentTipBenefits,
            bechdelNotes:                result.bechdelNotes,
            timeRecommendationReasoning: result.timeRecommendationReasoning,
            // Clear audit state so the next audit pass re-scores against the new content.
            needsRetranslate:  false,
            qualityScore:      null,
            qualityIssues:     null,
            auditedAt:         null,
          })
          .where(and(
            eq(gameTranslations.gameId, row.gameId),
            eq(gameTranslations.locale, locale),
          ))
        retranslated++
      } else {
        await db.insert(gameTranslations).values({
          gameId:                      row.gameId,
          locale,
          executiveSummary:            result.executiveSummary,
          benefitsNarrative:           result.benefitsNarrative,
          risksNarrative:              result.risksNarrative,
          parentTip:                   result.parentTip,
          parentTipBenefits:           result.parentTipBenefits,
          bechdelNotes:                result.bechdelNotes,
          timeRecommendationReasoning: result.timeRecommendationReasoning,
        }).onConflictDoNothing()
        translated++
      }
    }
  }

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    if (Date.now() - startedAt > BUDGET_MS) {
      console.log(`[translate] Budget reached after ${translated} translations`)
      break
    }
    await Promise.allSettled(pending.slice(i, i + BATCH_SIZE).map(processGame))
  }

  await logCronRun('translate-content', runStartedAt, {
    itemsProcessed: translated + retranslated,
    itemsSkipped:   skipped,
    errors,
    meta:           { translated, retranslated },
  })
  return NextResponse.json({
    ok: true,
    translated,
    retranslated,
    skipped,
    errors,
    elapsedMs: Date.now() - startedAt,
  })
}
