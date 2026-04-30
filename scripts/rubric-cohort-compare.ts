/**
 * Compare scoring distribution: first 2000 games vs latest 200 games.
 * Ordered by games.id (serial insertion order — proxy for review chronology).
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/rubric-cohort-compare.ts
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })

import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: unknown, decimals = 3): string {
  if (v == null) return 'null'
  const n = Number(v)
  return isNaN(n) ? String(v) : n.toFixed(decimals)
}

function diff(a: unknown, b: unknown): string {
  const na = Number(a), nb = Number(b)
  if (isNaN(na) || isNaN(nb)) return ''
  const d = nb - na
  const sign = d >= 0 ? '+' : ''
  return `(${sign}${d.toFixed(3)})`
}

function bar(v: unknown, max = 1, width = 20): string {
  const n = Math.min(Number(v) / max, 1)
  const filled = Math.round(n * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pct(v: unknown): string {
  const n = Number(v)
  return isNaN(n) ? 'null' : `${(n * 100).toFixed(1)}%`
}

// ─── Queries ─────────────────────────────────────────────────────────────────

const COHORT_SQL = (where: string) => sql.raw(`
  SELECT
    count(*)                                    AS n,

    -- ── COMPOSITE SCORES ──
    avg(gs.bds)                                 AS avg_bds,
    avg(gs.ris)                                 AS avg_ris,
    avg(gs.curascore)                           AS avg_curascore,
    stddev(gs.bds)                              AS sd_bds,
    stddev(gs.ris)                              AS sd_ris,
    stddev(gs.curascore)                        AS sd_curascore,

    -- ── BENEFIT SUB-SCORES ──
    avg(gs.cognitive_score)                     AS avg_cognitive,
    avg(gs.social_emotional_score)              AS avg_social_emotional,
    avg(gs.motor_score)                         AS avg_motor,

    -- ── RISK SUB-SCORES ──
    avg(gs.dopamine_risk)                       AS avg_dopamine,
    avg(gs.monetization_risk)                   AS avg_monetization,
    avg(gs.social_risk)                         AS avg_social_risk,
    avg(gs.content_risk)                        AS avg_content_risk,

    -- ── TIME RECOMMENDATION DISTRIBUTION ──
    count(*) FILTER (WHERE gs.time_rec_minutes = 120)  AS t_120,
    count(*) FILTER (WHERE gs.time_rec_minutes = 90)   AS t_90,
    count(*) FILTER (WHERE gs.time_rec_minutes = 60)   AS t_60,
    count(*) FILTER (WHERE gs.time_rec_minutes = 30)   AS t_30,
    count(*) FILTER (WHERE gs.time_rec_minutes = 15)   AS t_15,
    count(*) FILTER (WHERE gs.time_rec_minutes IS NULL) AS t_null,

    -- ── RAW REVIEW SCORE AVERAGES (0-5 benefits / 0-3 risks) ──
    -- Benefits B1 (cognitive)
    avg(r.problem_solving)                      AS b_problem_solving,
    avg(r.spatial_awareness)                    AS b_spatial_awareness,
    avg(r.strategic_thinking)                   AS b_strategic_thinking,
    avg(r.critical_thinking)                    AS b_critical_thinking,
    avg(r.memory_attention)                     AS b_memory_attention,
    avg(r.creativity)                           AS b_creativity,
    avg(r.reading_language)                     AS b_reading_language,
    avg(r.math_systems)                         AS b_math_systems,
    avg(r.learning_transfer)                    AS b_learning_transfer,
    avg(r.adaptive_challenge)                   AS b_adaptive_challenge,
    -- Benefits B2 (social-emotional)
    avg(r.teamwork)                             AS b_teamwork,
    avg(r.communication)                        AS b_communication,
    avg(r.empathy)                              AS b_empathy,
    avg(r.emotional_regulation)                 AS b_emotional_regulation,
    avg(r.ethical_reasoning)                    AS b_ethical_reasoning,
    avg(r.positive_social)                      AS b_positive_social,
    -- Benefits B3 (motor)
    avg(r.hand_eye_coord)                       AS b_hand_eye_coord,
    avg(r.fine_motor)                           AS b_fine_motor,
    avg(r.reaction_time)                        AS b_reaction_time,
    avg(r.physical_activity)                    AS b_physical_activity,
    -- Risks R1 (dopamine)
    avg(r.variable_rewards)                     AS r1_variable_rewards,
    avg(r.streak_mechanics)                     AS r1_streak_mechanics,
    avg(r.loss_aversion)                        AS r1_loss_aversion,
    avg(r.fomo_events)                          AS r1_fomo_events,
    avg(r.stopping_barriers)                    AS r1_stopping_barriers,
    avg(r.notifications)                        AS r1_notifications,
    avg(r.near_miss)                            AS r1_near_miss,
    avg(r.infinite_play)                        AS r1_infinite_play,
    avg(r.escalating_commitment)                AS r1_escalating_commitment,
    avg(r.variable_reward_freq)                 AS r1_variable_reward_freq,
    -- Risks R2 (monetization)
    avg(r.spending_ceiling)                     AS r2_spending_ceiling,
    avg(r.pay_to_win)                           AS r2_pay_to_win,
    avg(r.currency_obfuscation)                 AS r2_currency_obfuscation,
    avg(r.spending_prompts)                     AS r2_spending_prompts,
    avg(r.child_targeting)                      AS r2_child_targeting,
    avg(r.ad_pressure)                          AS r2_ad_pressure,
    avg(r.subscription_pressure)               AS r2_subscription_pressure,
    avg(r.social_spending)                      AS r2_social_spending,
    -- Risks R3 (social)
    avg(r.social_obligation)                    AS r3_social_obligation,
    avg(r.competitive_toxicity)                 AS r3_competitive_toxicity,
    avg(r.stranger_risk)                        AS r3_stranger_risk,
    avg(r.social_comparison)                    AS r3_social_comparison,
    avg(r.identity_self_worth)                  AS r3_identity_self_worth,
    avg(r.privacy_risk)                         AS r3_privacy_risk,
    -- Risks R4 (content)
    avg(r.violence_level)                       AS r4_violence,
    avg(r.sexual_content)                       AS r4_sexual,
    avg(r.language_content)                     AS r4_language,
    avg(r.substance_ref)                        AS r4_substance,
    avg(r.fear_horror)                          AS r4_fear_horror,

    -- ── METHODOLOGY ──
    mode() WITHIN GROUP (ORDER BY gs.methodology_version) AS mode_methodology,
    mode() WITHIN GROUP (ORDER BY r.ai_model)              AS mode_ai_model,

    -- ── AGE ──
    avg(gs.recommended_min_age)                 AS avg_min_age,

    -- ── CURASCORE BUCKETS ──
    count(*) FILTER (WHERE gs.curascore >= 80)  AS cura_80plus,
    count(*) FILTER (WHERE gs.curascore >= 60 AND gs.curascore < 80) AS cura_60_79,
    count(*) FILTER (WHERE gs.curascore >= 40 AND gs.curascore < 60) AS cura_40_59,
    count(*) FILTER (WHERE gs.curascore < 40)   AS cura_under40,
    count(*) FILTER (WHERE gs.curascore IS NULL) AS cura_null

  FROM (${where}) ordered_games
  JOIN game_scores gs ON gs.game_id = ordered_games.id
  LEFT JOIN reviews r ON r.id = gs.review_id
`)

const FIRST_2000 = `
  SELECT g.id FROM games g
  JOIN game_scores gs2 ON gs2.game_id = g.id
  ORDER BY g.id ASC
  LIMIT 2000
`

const LATEST_200 = `
  SELECT g.id FROM games g
  JOIN game_scores gs2 ON gs2.game_id = g.id
  ORDER BY g.id DESC
  LIMIT 200
`

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║     Rubric cohort comparison: first 2000 vs latest 200  ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  const [earlyRows, lateRows] = await Promise.all([
    db.execute(COHORT_SQL(FIRST_2000)),
    db.execute(COHORT_SQL(LATEST_200)),
  ])

  // postgres.js returns rows directly as an array
  const earlyArr = Array.isArray(earlyRows) ? earlyRows : (earlyRows as { rows: Row[] }).rows
  const lateArr  = Array.isArray(lateRows)  ? lateRows  : (lateRows  as { rows: Row[] }).rows

  const e = earlyArr[0] as Row
  const l = lateArr[0]  as Row

  const n_e = Number(e.n)
  const n_l = Number(l.n)

  // ── HEADER ────────────────────────────────────────────────────────────────
  console.log(`${'METRIC'.padEnd(32)} ${'EARLY (first 2000)'.padEnd(22)} ${'LATE (last 200)'.padEnd(22)} DELTA`)
  console.log('─'.repeat(90))

  function row(label: string, ek: string, lk?: string) {
    const lkey = lk ?? ek
    const ev = e[ek], lv = l[lkey]
    console.log(`  ${label.padEnd(30)} ${fmt(ev).padEnd(22)} ${fmt(lv).padEnd(22)} ${diff(ev, lv)}`)
  }

  // ── COMPOSITE ─────────────────────────────────────────────────────────────
  console.log('\n▶ COMPOSITE SCORES (0–1 normalized)\n')
  row('BDS (benefit density)', 'avg_bds')
  row('RIS (risk intensity)', 'avg_ris')
  row('σ BDS', 'sd_bds')
  row('σ RIS', 'sd_ris')
  const n_cura_e = Number(e.n) - Number(e.cura_null)
  const n_cura_l = Number(l.n) - Number(l.cura_null)
  console.log(`  ${'Curascore (0–100)'.padEnd(30)} ${fmt(e.avg_curascore, 1).padEnd(22)} ${fmt(l.avg_curascore, 1).padEnd(22)} ${diff(e.avg_curascore, l.avg_curascore)}`)
  console.log(`  ${'σ Curascore'.padEnd(30)} ${fmt(e.sd_curascore, 1).padEnd(22)} ${fmt(l.sd_curascore, 1).padEnd(22)} ${diff(e.sd_curascore, l.sd_curascore)}`)
  console.log(`  ${'Curascore coverage'.padEnd(30)} ${String(n_cura_e).padEnd(22)} ${String(n_cura_l).padEnd(22)}`)

  // ── BENEFIT SUB-SCORES ────────────────────────────────────────────────────
  console.log('\n▶ BENEFIT SUB-SCORES (0–1)\n')
  row('Cognitive (B1)', 'avg_cognitive')
  row('Social-Emotional (B2)', 'avg_social_emotional')
  row('Motor (B3)', 'avg_motor')

  // ── RISK SUB-SCORES ───────────────────────────────────────────────────────
  console.log('\n▶ RISK SUB-SCORES (0–1)\n')
  row('Dopamine (R1)', 'avg_dopamine')
  row('Monetization (R2)', 'avg_monetization')
  row('Social Risk (R3)', 'avg_social_risk')
  row('Content Risk (R4)', 'avg_content_risk')

  // ── TIME DISTRIBUTION ─────────────────────────────────────────────────────
  console.log('\n▶ TIME RECOMMENDATION DISTRIBUTION\n')
  for (const [mins, ek, color] of [
    ['120 min (green)', 't_120', ''],
    ['90 min  (green)', 't_90',  ''],
    ['60 min  (amber)', 't_60',  ''],
    ['30 min  (amber)', 't_30',  ''],
    ['15 min  (red)',   't_15',  ''],
  ] as const) {
    const ev = Number(e[ek]), lv = Number(l[ek])
    const ep = pct(ev / n_e), lp = pct(lv / n_l)
    console.log(`  ${mins.padEnd(20)} ${String(ev).padStart(5)} (${ep.padStart(6)})     ${String(lv).padStart(4)} (${lp.padStart(6)})`)
  }

  // ── CURASCORE BUCKETS ─────────────────────────────────────────────────────
  console.log('\n▶ CURASCORE BUCKETS\n')
  for (const [label, ek] of [
    ['≥ 80 (excellent)', 'cura_80plus'],
    ['60–79 (good)',     'cura_60_79'],
    ['40–59 (moderate)', 'cura_40_59'],
    ['< 40 (concern)',   'cura_under40'],
    ['null (no score)',  'cura_null'],
  ] as const) {
    const ev = Number(e[ek]), lv = Number(l[ek])
    const ep = pct(ev / n_e), lp = pct(lv / n_l)
    console.log(`  ${label.padEnd(20)} ${String(ev).padStart(5)} (${ep.padStart(6)})     ${String(lv).padStart(4)} (${lp.padStart(6)})`)
  }

  // ── RAW DIMENSION DETAIL ──────────────────────────────────────────────────
  console.log('\n▶ BENEFIT DIMENSIONS (0–5 raw avg)\n')
  for (const [label, ek] of [
    ['Problem Solving',      'b_problem_solving'],
    ['Spatial Awareness',    'b_spatial_awareness'],
    ['Strategic Thinking',   'b_strategic_thinking'],
    ['Critical Thinking',    'b_critical_thinking'],
    ['Memory/Attention',     'b_memory_attention'],
    ['Creativity',           'b_creativity'],
    ['Reading/Language',     'b_reading_language'],
    ['Math/Systems',         'b_math_systems'],
    ['Learning Transfer',    'b_learning_transfer'],
    ['Adaptive Challenge',   'b_adaptive_challenge'],
    ['Teamwork',             'b_teamwork'],
    ['Communication',        'b_communication'],
    ['Empathy',              'b_empathy'],
    ['Emotional Regulation', 'b_emotional_regulation'],
    ['Ethical Reasoning',    'b_ethical_reasoning'],
    ['Positive Social',      'b_positive_social'],
    ['Hand-Eye Coord',       'b_hand_eye_coord'],
    ['Fine Motor',           'b_fine_motor'],
    ['Reaction Time',        'b_reaction_time'],
    ['Physical Activity',    'b_physical_activity'],
  ] as const) {
    const ev = e[ek], lv = l[ek]
    const d = diff(ev, lv)
    const flagged = Math.abs(Number(lv) - Number(ev)) > 0.3 ? ' ←' : ''
    console.log(`  ${label.padEnd(24)} ${fmt(ev).padEnd(12)} ${fmt(lv).padEnd(12)} ${d}${flagged}`)
  }

  console.log('\n▶ RISK DIMENSIONS (0–3 raw avg)\n')
  for (const [label, ek] of [
    // R1
    ['Variable Rewards',      'r1_variable_rewards'],
    ['Streak Mechanics',      'r1_streak_mechanics'],
    ['Loss Aversion',         'r1_loss_aversion'],
    ['FOMO Events',           'r1_fomo_events'],
    ['Stopping Barriers',     'r1_stopping_barriers'],
    ['Notifications',         'r1_notifications'],
    ['Near Miss',             'r1_near_miss'],
    ['Infinite Play',         'r1_infinite_play'],
    ['Escalating Commitment', 'r1_escalating_commitment'],
    ['Variable Reward Freq',  'r1_variable_reward_freq'],
    // R2
    ['Spending Ceiling',      'r2_spending_ceiling'],
    ['Pay-to-Win',            'r2_pay_to_win'],
    ['Currency Obfusc.',      'r2_currency_obfuscation'],
    ['Spending Prompts',      'r2_spending_prompts'],
    ['Child Targeting',       'r2_child_targeting'],
    ['Ad Pressure',           'r2_ad_pressure'],
    ['Subscription Pressure', 'r2_subscription_pressure'],
    ['Social Spending',       'r2_social_spending'],
    // R3
    ['Social Obligation',     'r3_social_obligation'],
    ['Competitive Toxicity',  'r3_competitive_toxicity'],
    ['Stranger Risk',         'r3_stranger_risk'],
    ['Social Comparison',     'r3_social_comparison'],
    ['Identity/Self-Worth',   'r3_identity_self_worth'],
    ['Privacy Risk',          'r3_privacy_risk'],
    // R4
    ['Violence Level',        'r4_violence'],
    ['Sexual Content',        'r4_sexual'],
    ['Language',              'r4_language'],
    ['Substance Ref',         'r4_substance'],
    ['Fear/Horror',           'r4_fear_horror'],
  ] as const) {
    const ev = e[ek], lv = l[ek]
    const d = diff(ev, lv)
    const flagged = Math.abs(Number(lv) - Number(ev)) > 0.15 ? ' ←' : ''
    console.log(`  ${label.padEnd(24)} ${fmt(ev).padEnd(12)} ${fmt(lv).padEnd(12)} ${d}${flagged}`)
  }

  // ── METHODOLOGY ───────────────────────────────────────────────────────────
  console.log('\n▶ METHODOLOGY\n')
  console.log(`  ${'version (mode)'.padEnd(30)} ${String(e.mode_methodology ?? 'null').padEnd(22)} ${String(l.mode_methodology ?? 'null')}`)
  console.log(`  ${'AI model (mode)'.padEnd(30)} ${String(e.mode_ai_model ?? 'null').padEnd(22)} ${String(l.mode_ai_model ?? 'null')}`)
  console.log(`  ${'Avg recommended min age'.padEnd(30)} ${fmt(e.avg_min_age, 1).padEnd(22)} ${fmt(l.avg_min_age, 1).padEnd(22)} ${diff(e.avg_min_age, l.avg_min_age)}`)

  // ── DRIFT SUMMARY ─────────────────────────────────────────────────────────
  console.log('\n▶ DRIFT SUMMARY\n')
  const bds_d  = Number(l.avg_bds)  - Number(e.avg_bds)
  const ris_d  = Number(l.avg_ris)  - Number(e.avg_ris)
  const cura_d = Number(l.avg_curascore) - Number(e.avg_curascore)

  function flag(d: number, threshold: number, name: string, dir: string) {
    if (Math.abs(d) > threshold) {
      const sign = d > 0 ? `+${d.toFixed(3)} HIGHER` : `${d.toFixed(3)} LOWER`
      console.log(`  ⚠  ${name}: ${sign} in latest batch ${dir}`)
    } else {
      console.log(`  ✓  ${name}: stable (Δ = ${d > 0 ? '+' : ''}${d.toFixed(3)})`)
    }
  }

  flag(bds_d,  0.05, 'BDS',       '(benefits inflated/deflated?)')
  flag(ris_d,  0.05, 'RIS',       '(risks inflated/deflated?)')
  flag(cura_d, 5.0,  'Curascore', '(overall quality drift?)')

  console.log()
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
