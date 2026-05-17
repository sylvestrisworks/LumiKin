# GSC Audit — 2026-05-16 (completion log added 2026-05-17)

Snapshot taken from `docs/gsc/senaste/Ny mapp/` (90-day window, last 3 months).
This document is the working record for the May 8 traffic cliff and the broader
SEO punch list that came out of analyzing the same GSC export.

## Status (2026-05-17) — what shipped, what's pending

All 5 code phases are deployed. Only manual GSC + Vercel steps remain.

| Item | Status | Commit / Note |
|---|---|---|
| May 8 cliff fix — UGC JSON-LD | ✅ shipped | `b7a31ffc` |
| **Phase A** — GSC indexing requests | ⏳ manual | user task |
| **Phase B** — Verdict titles + FAQ + drop aggregateRating | ✅ shipped | `83cff0ae` |
| **Phase C.1** — Middleware 307→308 | ✅ shipped | `13e91777` (verified live, returns 308) |
| **Phase C.2** — Vercel www→apex 308 | ⏳ manual | Vercel dashboard or `vercel.json` |
| **Phase D** — Organization + Brand on homepage | ✅ shipped | `58471d80` |
| **Phase E** — Swedish localization (UGC + catalog) | ✅ shipped | `e00a0758` |

**Deferred follow-ups (queued, not blocking recovery):**

- Standard catalog verdict-led titles — needs new i18n keys across 5 locale files
- FR/DE/ES verdict meta translations — currently EN placeholders; re-run `scripts/add-verdict-meta-keys.mjs` with translated copy
- DE parent-vocab pass — German is 3rd-highest country (459 imp); needs "Altersfreigabe" treatment analogous to Swedish "åldersgräns"
- Localized FAQ Q&A pairs — currently EN-only on all templates
- DB `timeRecommendationLabel` runtime localization map — ~5 fixed values stored English-only in DB show through into SV/DE/FR/ES meta descriptions (e.g. "Up to 60 min/day" appearing mid-Swedish-sentence). ~15-line fix.

**Recovery clock starts 2026-05-17.** Expect:
- Review snippets returning in GSC within 3-10 days
- FAQ snippets appearing as a new Search-appearance entry within 3-7 days
- Position normalizing toward ~11 within 1-2 weeks
- URL variants (`lumikin.org/game/X` etc.) dropping out of `Sidor.csv` over 2-4 weeks as 308s consolidate
- Brand entity / "lumiscore" position improvement within 1-2 weeks of homepage re-crawl
- Sweden average position improvement (23 → 12-15) over 2-4 weeks

## Part 1 — The May 8 cliff (DONE, deployed)

### Observed pattern

From `Diagram.csv`:

| Date | Clicks | Impressions | Position |
|---|---|---|---|
| 2026-05-07 | 3 | 707 | 11.1 |
| **2026-05-08** | **0** | **61** (-91%) | **17.4** |
| 2026-05-09 → 14 | 0 | 30-78 | 21-35 |

Simultaneous ~90% impression loss + ~14-position drop. From
`Visningssätt i sökresultaten.csv`: **100% of all clicks and impressions came
via "Recensionsutdrag" (Review snippets)**. The site is/was entirely dependent
on Review rich snippets for SERP visibility.

### Root cause

The Roblox experience template (`src/app/[locale]/game/roblox/[experienceSlug]/page.tsx`)
and the Fortnite Creative template (`src/app/[locale]/game/fortnite-creative/[mapSlug]/page.tsx`)
**emitted zero structured data**. The main game template
(`src/app/[locale]/game/[slug]/page.tsx`) got Review JSON-LD in commit
`68103cce` on 2026-04-26 — but the two UGC templates were never updated.

Top-impression URLs in `Sidor.csv` are dominated by UGC pages
(brookhaven-rp 193 imp, blox-fruits 171, adopt-me 90, jujutsu-shenanigans 64,
travel-dubai-rp 36, swing-to-steal-devil-fruits 36, etc.). When Google did a
Review-snippet eligibility refresh on May 7-8, it re-crawled UGC URLs, found
no Review/VideoGame/BreadcrumbList schema, and dropped them from the snippet
program. Because UGC carried 100% of snippet impressions, total site traffic
collapsed.

Confirmed via:
- `Invoke-WebRequest` on `lumikin.org/sv/game/roblox/jujutsu-shenanigans` →
  0 `ld+json` blocks in HTML, 0 `schema.org` references
- `Invoke-WebRequest` on `lumikin.org/sv/game/god-of-war-2` (standard catalog)
  → 6 `ld+json` blocks, 4 VideoGame refs, 1 Review ref. Catalog template is
  fine, only UGC was broken.
- Rich Results Test on a Roblox URL returned "No items detected"

### Fix shipped — commit `b7a31ffc` (2026-05-16)

Added VideoGame + BreadcrumbList + Review JSON-LD blocks to both
`src/app/[locale]/game/roblox/[experienceSlug]/page.tsx` and
`src/app/[locale]/game/fortnite-creative/[mapSlug]/page.tsx`, modeled on the
existing schema in the main game page, with the same `<`/`>`/`&`
escape pattern. Review block only renders when a LumiScore exists (avoids
empty-Review rejection).

Notable choices:
- No `aggregateRating` on UGC (no Metacritic-equivalent; avoids the
  `ratingCount: 1` issue flagged in Part 2)
- `publisher` derived from `creatorName`
- `gamePlatform` fixed to "Roblox" or "Fortnite"
- Breadcrumbs go Home → Browse → Roblox/Fortnite Creative → [title]

### Recovery checklist

- [x] Push to production (done with b7a31ffc)
- [ ] After deploy, view-source on `lumikin.org/sv/game/roblox/jujutsu-shenanigans`
      → confirm 3 `<script type="application/ld+json">` blocks present
- [ ] Run https://search.google.com/test/rich-results on a top Roblox URL
      → should now say "Page is eligible for rich results" with Review +
      Breadcrumbs detected
- [ ] In GSC, URL-inspect 5–10 top UGC URLs from `Sidor.csv`, click
      "Request Indexing" on each
- [ ] Watch Performance → Search appearance → Review snippets dimension over
      the next 3–10 days. Recovery should show impressions returning first,
      then position normalizing back toward 11

---

## Part 2 — Remaining issues (NOT YET DONE)

These were found while analyzing the same GSC export. Ranked by impact.

### Issue 1: Sitewide CTR ~0.5% is the meta-disaster

Even before May 8, CTR was catastrophic. May 4: 6 clicks / 648 impressions.
At average position 11, normal CTR is 3–8%. Lumikin gets roughly 1/10th of
expected click-through.

Specific pages that prove it isn't a ranking problem:

| Page | Impressions | Position | Clicks |
|---|---|---|---|
| `game/roblox/brookhaven-rp` | 193 | **9.55** | **0** |
| `game/roblox/blox-fruits` | 171 | 9.41 | 0 |
| `en/game/roblox/adopt-me` | 90 | 9.86 | 0 |
| `en/game/pikuniku-2` | 88 | **2.97** | **0** ← statistically impossible without an issue |
| `en/game/roblox/99-nights-in-the-forest` | 70 | 9.87 | 0 |

Likely causes:
- Snippet doesn't surface the answer ("LumiScore 65/100, Age 9+, 60 min/day")
- Title leads with brand instead of verdict
- No rich-snippet visual hook (this fixed for UGC by Part 1, but title/meta
  rewrite still needed)

**Recommended fix:** Rewrite `generateMetadata` in both game and UGC templates
to lead with the parent-relevant answer:

```
title: "Brookhaven RP — Safe for kids? Age 9+ · LumiScore 72/100"
description: "LumiScore 72/100 · Age 9+ · Up to 60 min/day. Parent verdict
              and risk breakdown for Brookhaven RP on Roblox."
```

Highest dollar-value fix in this whole document. Brookhaven alone is leaving
~10 visits/month on the table; multiply across the catalog.

### Issue 2: Three URL variants competing in the index

Same content appears as three separate ranked URLs in `Sidor.csv`:
- `lumikin.org/game/roblox/blox-fruits` — 171 imp, pos 9.41
- `www.lumikin.org/en/game/roblox/blox-fruits` — 164 imp, pos 7.88
- `lumikin.org/en/game/roblox/blox-fruits` — appears further down

Tested directly:
- `lumikin.org/game/roblox/brookhaven-rp` → **307 Temporary Redirect**
- `www.lumikin.org/game/roblox/brookhaven-rp` → **307**
- `lumikin.org/en/game/roblox/brookhaven-rp` → **200**, canonical = self
- `www.lumikin.org/en/game/roblox/brookhaven-rp` → **307**

Redirects work, but **307 doesn't fully transfer ranking signal** (Google
treats it as "may change back"). After 90 days, all three variants are still
indexed splitting ranking signal.

**Recommended fix:** Switch i18n middleware redirects from 307 → **308
(permanent)** in `src/middleware.ts`. Wait 2–4 weeks for Google to
re-consolidate. Resubmit top URLs for indexing to speed it up.

### Issue 3: Sweden underperforms despite localization

From `Länder.csv`:

| Country | Clicks | Impressions | Position |
|---|---|---|---|
| USA | 23 | 3493 | 10.42 |
| UK | 6 | 651 | 11.9 |
| Germany | 5 | 459 | 14.84 |
| France | 4 | 331 | 15.86 |
| **Sweden** | **3** | **817** | **23.32** |
| Canada | 3 | 376 | 11.85 |

Sweden has 1/4 of US impressions but ranks 13 positions worse. The Swedish
pages are auto-translated by Vertex AI (see memory `project_gemini_pause`).
Auto-translation is likely missing Swedish parent-vernacular — Swedish
queries in `Frågor.csv` use "åldersgräns" (e.g. "åldersgräns dota",
"åldersgräns counter strike", "among us åldersgräns") and the Swedish pages
probably translate "age rating" literally instead.

**Recommended fix:** Spot-check `lumikin.org/sv/game/roblox/jujutsu-shenanigans`
for whether "åldersgräns" appears in the H1, title, and meta description.
If not, customize the Swedish translation keys for parent-search vocabulary.

### Issue 4: Single-feature SERP dependence

`Visningssätt i sökresultaten.csv` lists exactly **one** rich-result feature:
Review snippets (29 clicks, 6052 impressions). No FAQ, no breadcrumbs, no
sitelinks, no how-to. Betting the entire SERP-visibility strategy on one
feature is what made May 8 so total.

Biggest gap: **FAQ schema** for the questions parents literally type. From
`Frågor.csv`:
- "is blox fruits safe for kids" — 6 imp, pos 8.17
- "what is blox fruits age rating" — 6 imp, pos 8.33
- "is blox fruits a kids game?" — 6 imp, pos 9.5
- "is roblox adopt me safe for kids" — 5 imp, pos 11.6
- "is brookhaven safe for kids" — 3 imp, pos 11
- "is X safe for kids" pattern repeats across dozens of games

**Recommended fix:** Add `FAQPage` schema to game and UGC templates with 3–4
auto-generated Q&A pairs per game ("Is X safe for kids?", "What's the age
rating?", "How long should my child play?", "What are the risks?"). Pulls
from existing fields. One template change → multiplies snippet eligibility
across the catalog.

### Issue 5: Brand discovery is broken

From `Frågor.csv`:
- `lumikin` — 20 impressions, **position 1.75**, only **2 clicks** (10% CTR
  on a branded query — should be 40–60%)
- `lumiscore` — 4 impressions, **position 18.5** (your own product metric
  doesn't surface on your own domain)

Suggests the homepage lacks proper Organization schema and the metric name
isn't tied to brand entity.

**Recommended fix:** Add Organization + Brand JSON-LD to homepage
(`src/app/[locale]/page.tsx`):

```ts
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "LumiKin",
  "url": "https://lumikin.org",
  "logo": "https://lumikin.org/logo.png",
  "description": "Parent safety ratings for video games and Roblox/Fortnite experiences",
  "brand": { "@type": "Brand", "name": "LumiScore" }
}
```

### Issue 6: Desktop has 2× the impressions but suspect CTR

From `Enheter.csv`:

| Device | Clicks | Impressions | CTR | Position |
|---|---|---|---|---|
| Mobile | 40 | 4342 | 0.92% | 10.18 |
| Desktop | 26 | 7502 | 0.35% | 14.89 |
| Tablet | 3 | 323 | 0.93% | 8.1 |

Desktop has 2× mobile impressions but worse CTR. Parents researching kid-game
safety are overwhelmingly on mobile (school pickup, evening on the couch).
Likely a chunk of the desktop volume is AI scraper bots / aggregator research
traffic with no purchase intent.

Not directly actionable but **explains why headline CTR looks worse than it
actually is**. The 0.92% mobile number is closer to real audience signal.

### Issue 7: Latent `aggregateRating` snippet risk on standard catalog

Code in `src/app/[locale]/game/[slug]/page.tsx:390-392` emits:

```ts
aggregateRating: game.metacriticScore
  ? { '@type': 'AggregateRating', ratingValue: game.metacriticScore,
      bestRating: 100, ratingCount: 1 }
  : undefined,
```

Google explicitly warns against single-source `aggregateRating`. Currently
hasn't been flagged, but on the next Google enhancement refresh this could
disqualify the standard-catalog Review snippet the same way UGC just got
disqualified. Latent risk, not urgent.

**Recommended fix:** Either drop `aggregateRating` entirely, or replace
`ratingCount: 1` with a real count sourced from Metacritic critic-review
count (their API exposes this).

---

## Part 3 — Why UGC is the moat (strategic framing)

The May 8 cliff also surfaced a strategic insight worth recording:

**UGC isn't dominant traffic because the catalog is broken — UGC is dominant
because UGC is the moat.**

From `Frågor.csv`, the highest-volume parent-intent queries that lumikin
ranks for:
- "blox fruits age rating" — pos 9.5
- "99 nights in the forest roblox age rating" — pos 12.7
- "is blox fruits safe for kids" — pos 8.17
- "blox fruits roblox age rating" — pos 10
- "can you play rivals in roblox kids" — pos 8.4

These rank top-10 because **no Common Sense Media equivalent exists for
individual Roblox experiences.** Common Sense reviews Roblox-the-platform
once. Lumikin reviews jujutsu-shenanigans, travel-dubai-rp, clip-it,
swing-to-steal-devil-fruits as separate experiences. Empty SERP slot walked
into.

Contrast with standard catalog queries:
- "tetris" — pos 58
- "ragnarok online" — pos 54
- "everquest kostenlos" — pos 37
- "bridge crew" — pos 60

On any major established title, ESRB/Metacritic/IGN/Common Sense own the
SERP. Lumikin's standard-catalog template is technically healthy (6 ld+json
blocks confirmed in prod), but it can't out-authority a 20-year-old site.

**Implications:**
- Fortnite Creative is the next Roblox — same empty-snippet dynamic. The fix
  shipped today should start collecting that traffic
- Growth lever is UGC depth (more experiences scored, deeper Fortnite
  coverage), not catalog breadth (no value in adding more AAA titles)
- Standard catalog still earns its keep for topical breadth + long-tail
  localized wins (Spanish/French/German pages with 100% CTR on 1-3
  impressions = real signal), just don't expect it to scale

---

## Reference — files in this analysis

- `docs/gsc/senaste/Ny mapp/Diagram.csv` — daily clicks/imp/CTR/pos
- `docs/gsc/senaste/Ny mapp/Sidor.csv` — per-page metrics
- `docs/gsc/senaste/Ny mapp/Frågor.csv` — per-query metrics
- `docs/gsc/senaste/Ny mapp/Länder.csv` — per-country
- `docs/gsc/senaste/Ny mapp/Enheter.csv` — per-device
- `docs/gsc/senaste/Ny mapp/Visningssätt i sökresultaten.csv` — search appearance
- `docs/gsc/senaste/Ny mapp/Filter.csv` — filter applied (Web, last 3 months)
