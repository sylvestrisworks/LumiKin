# UGC platform data pipeline — durable rebuild plan

Captured 2026-05-14. Deferred until LumiKin has revenue to cover the ~$50–150/mo browser-farm cost. Until then, the band-aids in place (score floors, manual CDP-attach audits) are good enough.

This doc is the recovery point: when you have budget, start here.

## Why we keep doing band-aids

Same pattern, different month:

- Hand-curated hardcoded code lists rot (the `fetch-fortnite-maps/route.ts` curated list shows a 43% dead rate as of 2026-05-14)
- Headless fetch is Cloudflare-blocked on fortnite.com
- CDP-attach to your real Chrome works but needs you to clear challenges by hand — can't run unattended
- Epic's internal APIs (`links.community-svc.ol.epicgames.com`) don't resolve from non-Fortnite-client networks
- AI scoring from thin inputs (titles only) hallucinates — produced curascores up to 77 for empty-description maps before floors were added
- Four data sources (Epic API, fortnite.com web, scrape, hardcoded list) stitched together; none is authoritative; none has a freshness contract

The root issue isn't "Fortnite is hard." It's that there's no single source-of-truth pipeline for UGC platform data, and no quality contract between data and scores. Every workaround addresses one symptom and creates the next.

Roblox doesn't have this problem — they expose a real public API and the `fetch-roblox-experiences` cron uses it directly. The plan below is Fortnite-shaped but applies the same discipline to both.

## Three options considered

### Option A — Managed browser farm + freshness contract (recommended)

Use Browserless, ScrapingBee, Bright Data, or Apify. They solve Cloudflare; we get a stable HTTP API for "fetch this URL, run this JS, return JSON." Rebuild the Fortnite pipeline around that — no more CDP-attach, no manual challenge-clearing, runs in Vercel cron forever.

Cost: ~$50–150/mo depending on vendor and volume. **Blocked on revenue.**

### Option B — Cheap VPS + persistent Chrome session (rejected)

~$5/mo (Hetzner). One always-on Chrome with cleared cookies, Vercel crons reach it via Tailscale. Cheaper, but Cloudflare may re-challenge every few weeks and someone has to clear it. Rejected because it keeps the failure mode that brought us here — unattended operation is the actual goal.

### Option C — Drop per-map Fortnite tracking (live alternative if A stays unaffordable)

Score Fortnite Creative as a category (already done — base game scores 42) plus the existing genre/mode breakdown (Zone Wars, Deathrun, Box Fights). Don't maintain 1100+ individual maps. Roblox keeps per-experience tracking because it has a real API.

Biggest simplification. Eliminates the entire problem class at zero cost. **The right move if revenue takes longer than 6 months.** Before committing, check whether per-map pages move the product needle for parents or if mode-level coverage is sufficient.

## The build (Option A, when funded)

### 1. Data layer changes

- New table `data_sources` — one row per scrape attempt: `experience_id`, `source` (e.g., `fortnite.com`, `epic.discovery`), `fetched_at`, `success`, `raw_payload`, `data_hash`. Append-only log; drives freshness and observability.
- New column `platform_experiences.live_status` — enum `live | dead | unknown | pending_verification`. Replaces the overloaded `is_public`. Recomputed on every scrape.
- New column `experience_scores.input_confidence` — `0..1`, persisted with the score. Display gates and ranking respect it.
- Drop the hardcoded curated list in `src/app/api/cron/fetch-fortnite-maps/route.ts`. Source everything from live discovery.

### 2. Scraping layer

- One adapter per source in `src/lib/scraping/{fortnite,roblox}.ts`. Each implements `fetchExperience(code): Promise<RawExperience>`.
- Fortnite adapter hits Browserless (or equivalent). Wraps a Playwright script that runs server-side on their infrastructure — we send the script, they run it, return JSON.
- Built-in retry; dead-letter on persistent failure → `live_status = 'dead'` automatically.

### 3. Cron orchestration

Three crons, each with a single responsibility:

- `discover` — find new codes weekly (scrape Fortnite discovery surfaces)
- `refresh` — re-scrape stale rows every 7d (rows where `last fetched_at > 7d ago` OR `live_status = 'unknown'`)
- `score` — AI scoring when input changes (driven by `needs_rescore` flag, already in place)

Each cron writes to `data_sources` and updates `live_status`. No silent failures. Existing `cron-logger` captures per-run summaries.

### 4. AI quality gates

`experience_scores.input_confidence` derived from:

- has description (40%)
- has visit count (30%)
- has creator (10%)
- description quality > 50 chars (20%)

AI never produces a score when confidence < 0.5 — the row shows "not enough data" in the UI instead. Replaces the current floors-as-band-aid (see `applyScoreFloors()` in `src/lib/scoring/experience-risk.ts`). Floors stay for safety, but the primary defense becomes "don't score what we can't see."

### 5. Observability

- `/admin/data-quality` page: dead-row count, scrape failure rate per platform, low-confidence score count, time-since-last-refresh distribution.
- Alert (via existing `cron-logger` infrastructure) when dead-rows > 10% or scrape failures > 5%.

### 6. Migration plan

- **Phase 1 (week 1)**: introduce `data_sources` + `live_status` + `input_confidence` columns. Run them in shadow mode — write but don't read.
- **Phase 2 (week 2)**: sign up for Browserless, write Fortnite adapter, switch one cron at a time.
- **Phase 3 (week 3)**: rip out hardcoded list, switch display surfaces to read `live_status`, ship the admin dashboard.

Total: ~2–3 weeks of focused work. Monthly recurring cost: $50–150 for the browser farm.

## Decision points still open

When picking this up, resolve these before writing code:

1. **A or C?** Per-map Fortnite tracking — does it pull its weight in product, or could it go in favor of platform + mode-level coverage only? Check analytics on `/game/fortnite-creative/[mapSlug]` pageviews before deciding.
2. **If A: which browser-farm vendor?** Default to Browserless (cheapest, Playwright-compatible API). Apify is more featureful but pricier. Bright Data is enterprise-grade but expensive.
3. **`is_public` cleanup or new `live_status` column?** Former is faster (no migration); latter is semantically cleaner. Recommend `live_status` — `is_public` is already overloaded (Roblox-private vs Fortnite-dead are different states).

## Current state (what's in place as of 2026-05-14)

These ship now, give us breathing room, and don't need to be undone:

- **Score floors** (`src/lib/scoring/experience-risk.ts` → `applyScoreFloors`): dopamine ≥ 1, stranger ≥ 1 unless solo-pattern match, creativity/learning capped at 2 when description is short. Applied in `saveScore` and `rescoreExisting` in the cron route.
- **Refloor backfill** (`scripts/refloor-experiences.ts`): one-shot rescore over existing rows, no AI cost. Already run — top Fortnite Creative score dropped 77 → 68, maps over 70 went from 3 to 0.
- **CDP-attach audit** (`scripts/audit-fortnite-codes.ts`): one-shot 404 detection + creator backfill via your real Chrome. Validation run showed ~43% of the hardcoded curated list is dead; full run in progress at time of writing.
- **`isPublic` filters** added to display surfaces (`sitemap.ts`, `browse`, `platform`, `game/fortnite-creative` listing + detail, `api/search`) so dead rows disappear from UI when marked `is_public = false`.
- **Detail-page scraper** (`scripts/scrape-fortnite-detail.ts`): ready to run via CDP-attach if descriptions ever become high-priority before the Option A rebuild. Hit rate will be low (~20–40%); see `backlog_fortnite_detail_backfill.md` memory.

When revenue arrives and Option A is in scope: start with the migration plan above. The current band-aids can stay until Phase 3 cuts them over.
