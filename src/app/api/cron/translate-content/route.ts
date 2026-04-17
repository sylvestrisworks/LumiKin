import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, gameScores, reviews, gameTranslations } from '@/lib/db/schema'
import { eq, and, notExists, isNotNull } from 'drizzle-orm'

// ─── Config ───────────────────────────────────────────────────────────────────

const BEDROCK_MODEL = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
const BEDROCK_URL   = `https://bedrock-runtime.us-east-1.amazonaws.com/model/${BEDROCK_MODEL}/invoke`

const LOCALES = ['sv', 'de', 'fr', 'es'] as const
type Locale = typeof LOCALES[number]

const LANGUAGE_NAMES: Record<Locale, string> = {
  sv: 'Swedish',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
}

const MAX_GAMES_PER_RUN = 10
const BUDGET_MS         = 240_000

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
  // Only translate fields that have content
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
    const res = await fetch(BEDROCK_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AWS_BEARER_TOKEN_BEDROCK}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      if ((res.status === 429 || res.status === 503) && attempt < 2) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 3000))
        return translateToLocale(content, locale, attempt + 1)
      }
      console.error(`[translate] Bedrock ${res.status}: ${errText.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''

    // Extract JSON from response (model might wrap in ```json ... ```)
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
  if (!process.env.AWS_BEARER_TOKEN_BEDROCK) {
    return NextResponse.json({ error: 'AWS_BEARER_TOKEN_BEDROCK not set' }, { status: 500 })
  }

  const startedAt = Date.now()
  let translated = 0
  let skipped = 0
  let errors = 0

  // Find games that have scores but are missing at least one locale translation
  // Process one locale at a time to keep queries simple
  for (const locale of LOCALES) {
    if (Date.now() - startedAt > BUDGET_MS) {
      console.log(`[translate] Budget reached — stopping at locale ${locale}`)
      break
    }

    // Games scored but not yet translated for this locale
    const untranslated = await db
      .select({
        gameId:            games.id,
        slug:              games.slug,
        executiveSummary:  gameScores.executiveSummary,
        reviewId:          gameScores.reviewId,
      })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(and(
        isNotNull(gameScores.curascore),
        notExists(
          db.select({ id: gameTranslations.id })
            .from(gameTranslations)
            .where(and(
              eq(gameTranslations.gameId, games.id),
              eq(gameTranslations.locale, locale),
            ))
        )
      ))
      .limit(MAX_GAMES_PER_RUN)

    for (const row of untranslated) {
      if (Date.now() - startedAt > BUDGET_MS) break

      // Fetch review narratives if available
      let benefitsNarrative: string | null = null
      let risksNarrative:    string | null = null
      let parentTip:         string | null = null
      let parentTipBenefits: string | null = null
      let bechdelNotes:      string | null = null

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

        if (review) {
          benefitsNarrative = review.benefitsNarrative
          risksNarrative    = review.risksNarrative
          parentTip         = review.parentTip
          parentTipBenefits = review.parentTipBenefits
          bechdelNotes      = review.bechdelNotes
        }
      }

      const content: TranslatableContent = {
        executiveSummary:  row.executiveSummary,
        benefitsNarrative,
        risksNarrative,
        parentTip,
        parentTipBenefits,
        bechdelNotes,
      }

      // Skip if nothing to translate
      const hasContent = Object.values(content).some(v => v && v.trim())
      if (!hasContent) {
        skipped++
        // Insert empty row so we don't revisit this game
        await db.insert(gameTranslations).values({
          gameId: row.gameId,
          locale,
        }).onConflictDoNothing()
        continue
      }

      console.log(`[translate] ${row.slug} → ${locale}`)
      const result = await translateToLocale(content, locale)

      if (!result) {
        errors++
        continue
      }

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

  return NextResponse.json({
    ok: true,
    translated,
    skipped,
    errors,
    elapsedMs: Date.now() - startedAt,
  })
}
