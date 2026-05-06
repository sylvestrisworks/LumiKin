'use server'

import { auth } from '@/auth'
import { db } from '@/lib/db'
import {
  games, reviews, gameScores, darkPatterns, complianceStatus,
} from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export async function deleteGame(formData: FormData) {
  const session = await auth()
  const reviewerEmail = process.env.REVIEWER_EMAIL
  if (!session?.user?.email || session.user.email !== reviewerEmail) {
    redirect('/admin/pipeline?error=unauthorized')
  }

  const slug = formData.get('slug')?.toString().trim()
  if (!slug) redirect('/admin/pipeline?error=no-slug')

  const [game] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, slug))

  if (!game) redirect('/admin/pipeline?error=not-found')

  const gameReviews = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.gameId, game.id))

  const reviewIds = gameReviews.map(r => r.id)

  if (reviewIds.length > 0) {
    await db.delete(darkPatterns).where(inArray(darkPatterns.reviewId, reviewIds))
  }
  await db.delete(gameScores).where(eq(gameScores.gameId, game.id))
  if (reviewIds.length > 0) {
    await db.delete(reviews).where(eq(reviews.gameId, game.id))
  }
  await db.delete(complianceStatus).where(eq(complianceStatus.gameId, game.id))
  await db.delete(games).where(eq(games.id, game.id))

  redirect(`/admin/pipeline?deleted=${encodeURIComponent(slug)}`)
}
