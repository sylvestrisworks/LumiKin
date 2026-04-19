export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, reviews } from '@/lib/db/schema'
import ReviewForm from '@/components/ReviewForm'
import type { SerializedGame, SerializedReview } from '@/types/game'

export async function generateMetadata({ params }: { params: { gameSlug: string } }) {
  const [game] = await db
    .select({ title: games.title })
    .from(games)
    .where(eq(games.slug, params.gameSlug))
    .limit(1)

  return {
    title: game ? `Review: ${game.title} — LumiKin` : 'Review — LumiKin',
  }
}

export default async function ReviewPage({ params }: { params: { gameSlug: string } }) {
  const session = await auth()
  if (!session) {
    redirect(`/login?callbackUrl=/review/${params.gameSlug}`)
  }

  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.slug, params.gameSlug))
    .limit(1)

  if (!game) notFound()

  const [existing] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.gameId, game.id))
    .limit(1)

  const serializedGame: SerializedGame = {
    id:                   game.id,
    slug:                 game.slug,
    title:                game.title,
    description:          game.description ?? null,
    developer:            game.developer ?? null,
    publisher:            game.publisher ?? null,
    releaseDate:          game.releaseDate?.toISOString() ?? null,
    genres:               (game.genres as string[]) ?? [],
    platforms:            (game.platforms as string[]) ?? [],
    esrbRating:           game.esrbRating ?? null,
    metacriticScore:      game.metacriticScore ?? null,
    avgPlaytimeHours:     game.avgPlaytimeHours ?? null,
    backgroundImage:      game.backgroundImage ?? null,
    basePrice:            game.basePrice ?? null,
    hasMicrotransactions: game.hasMicrotransactions ?? false,
    hasLootBoxes:         game.hasLootBoxes ?? false,
    hasSubscription:      game.hasSubscription ?? false,
    hasBattlePass:        game.hasBattlePass ?? false,
    requiresInternet:     game.requiresInternet ?? null,
    hasStrangerChat:      game.hasStrangerChat ?? false,
    chatModeration:       game.chatModeration ?? null,
    updatedAt:            game.updatedAt?.toISOString() ?? null,
    bundledOnlineNote:    game.bundledOnlineNote ?? null,
  }

  let existingReview: SerializedReview | null = null
  if (existing) {
    existingReview = {
      problemSolving:      existing.problemSolving ?? null,
      spatialAwareness:    existing.spatialAwareness ?? null,
      strategicThinking:   existing.strategicThinking ?? null,
      criticalThinking:    existing.criticalThinking ?? null,
      memoryAttention:     existing.memoryAttention ?? null,
      creativity:          existing.creativity ?? null,
      readingLanguage:     existing.readingLanguage ?? null,
      mathSystems:         existing.mathSystems ?? null,
      learningTransfer:    existing.learningTransfer ?? null,
      adaptiveChallenge:   existing.adaptiveChallenge ?? null,
      teamwork:            existing.teamwork ?? null,
      communication:       existing.communication ?? null,
      empathy:             existing.empathy ?? null,
      emotionalRegulation: existing.emotionalRegulation ?? null,
      ethicalReasoning:    existing.ethicalReasoning ?? null,
      positiveSocial:      existing.positiveSocial ?? null,
      handEyeCoord:        existing.handEyeCoord ?? null,
      fineMotor:           existing.fineMotor ?? null,
      reactionTime:        existing.reactionTime ?? null,
      physicalActivity:    existing.physicalActivity ?? null,
      variableRewards:     existing.variableRewards ?? null,
      streakMechanics:     existing.streakMechanics ?? null,
      lossAversion:        existing.lossAversion ?? null,
      fomoEvents:          existing.fomoEvents ?? null,
      stoppingBarriers:    existing.stoppingBarriers ?? null,
      notifications:       existing.notifications ?? null,
      nearMiss:            existing.nearMiss ?? null,
      infinitePlay:        existing.infinitePlay ?? null,
      escalatingCommitment:existing.escalatingCommitment ?? null,
      variableRewardFreq:  existing.variableRewardFreq ?? null,
      spendingCeiling:     existing.spendingCeiling ?? null,
      payToWin:            existing.payToWin ?? null,
      currencyObfuscation: existing.currencyObfuscation ?? null,
      spendingPrompts:     existing.spendingPrompts ?? null,
      childTargeting:      existing.childTargeting ?? null,
      adPressure:          existing.adPressure ?? null,
      subscriptionPressure:existing.subscriptionPressure ?? null,
      socialSpending:      existing.socialSpending ?? null,
      socialObligation:    existing.socialObligation ?? null,
      competitiveToxicity: existing.competitiveToxicity ?? null,
      strangerRisk:        existing.strangerRisk ?? null,
      socialComparison:    existing.socialComparison ?? null,
      identitySelfWorth:   existing.identitySelfWorth ?? null,
      privacyRisk:         existing.privacyRisk ?? null,
      violenceLevel:       existing.violenceLevel ?? null,
      sexualContent:       existing.sexualContent ?? null,
      language:            existing.language ?? null,
      substanceRef:        existing.substanceRef ?? null,
      fearHorror:          existing.fearHorror ?? null,
      estimatedMonthlyCostLow:   existing.estimatedMonthlyCostLow ?? null,
      estimatedMonthlyCostHigh:  existing.estimatedMonthlyCostHigh ?? null,
      minSessionMinutes:         existing.minSessionMinutes ?? null,
      hasNaturalStoppingPoints:  existing.hasNaturalStoppingPoints ?? null,
      penalizesBreaks:           existing.penalizesBreaks ?? null,
      stoppingPointsDescription: existing.stoppingPointsDescription ?? null,
      r5CrossPlatform:      existing.r5CrossPlatform ?? null,
      r5LoadTime:           existing.r5LoadTime ?? null,
      r5MobileOptimized:    existing.r5MobileOptimized ?? null,
      r5LoginBarrier:       existing.r5LoginBarrier ?? null,
      r6InfiniteGameplay:   existing.r6InfiniteGameplay ?? null,
      r6NoStoppingPoints:   existing.r6NoStoppingPoints ?? null,
      r6NoGameOver:         existing.r6NoGameOver ?? null,
      r6NoChapterStructure: existing.r6NoChapterStructure ?? null,
      repGenderBalance:     existing.repGenderBalance ?? null,
      repEthnicDiversity:   existing.repEthnicDiversity ?? null,
      propagandaLevel:      existing.propagandaLevel ?? null,
      propagandaNotes:      existing.propagandaNotes ?? null,
      bechdelResult:        (existing.bechdelResult as 'pass' | 'fail' | 'na' | null) ?? null,
      bechdelNotes:         existing.bechdelNotes ?? null,
      usesVirtualCurrency:       existing.usesVirtualCurrency ?? null,
      virtualCurrencyName:       existing.virtualCurrencyName ?? null,
      virtualCurrencyRate:       existing.virtualCurrencyRate ?? null,
      benefitsNarrative:         existing.benefitsNarrative ?? null,
      risksNarrative:            existing.risksNarrative ?? null,
      parentTip:                 existing.parentTip ?? null,
      parentTipBenefits:         existing.parentTipBenefits ?? null,
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <a href="/review" className="text-slate-400 hover:text-slate-600 text-sm">
            ← All games
          </a>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-800">{game.title}</span>
          {existing && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Editing existing review
            </span>
          )}
        </div>
        <a href={`/game/${game.slug}`} target="_blank" rel="noopener noreferrer"
          className="text-xs text-indigo-600 hover:underline">
          View public page ↗
        </a>
      </header>

      <ReviewForm game={serializedGame} existingReview={existingReview} />
    </div>
  )
}
