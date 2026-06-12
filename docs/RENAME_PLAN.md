# Rename plan: LumiKin → Ludoverdi

**Status:** planned, not started. Drafted 2026-06-05.
**Decision:** Site/brand becomes **Ludoverdi**. The metric **stays "LumiScore"** (unchanged).

## The name

- **Ludoverdi** — *Ludo* (Latin *ludus*, play → gaming-friendly) + *verdi* (verdict/truth;
  and Norwegian/Danish *verdi* = "value/worth", so to a Nordic reader it reads as
  **"play-value"** — exactly the thesis).
- Pronunciation: *loo-doh-VER-dee*.
- Subtle science-×-gaming signal, sharp coinage (not a soft mashup), no aggregator vibe.
- **Domains available** (2026-06-05): `ludoverdi.com` ($11), `.org` ($10), `.kids` ($10),
  `.se` (register via a Swedish registrar — Vercel doesn't carry `.se`).
- **Clearance:** no trademark/company/app/handle collision found in web search.
  ⚠️ Search-clear ≠ legally clear — run **USPTO + EUIPO + WIPO Global Brand Database**
  (ideally a TM attorney) before filing, and verify `@ludoverdi` directly on each platform.

## Key simplification

The metric is stored as the DB column **`curascore`** (in `game_scores` and
`experience_scores`) — "LumiScore" was always just a *display* name over a legacy internal
identifier (originally "CuraScore"). Because **the metric name is not changing**, this rename
is **brand/wordmark only** — no metric strings, no schema migration, no metric i18n churn.

## Decisions locked

1. **Brand:** LumiKin → **Ludoverdi**.
2. **Metric:** **LumiScore unchanged.** Leave all `LumiScore` display strings as-is.
3. **DB column `curascore`:** leave as-is (internal, decoupled, already survived one rename).
4. **Domain:** `ludoverdi.com` (+ `.org`); keep `lumikin.org` registered and **301-redirect**.

## Scope by layer

### A. Brand wordmark & chrome — *LumiKin → Ludoverdi*
Live targets (the 667-hit grep is mostly docs/scripts; these are the rendered ones):
- `src/components/SiteNav.tsx`, `editorial/Masthead.tsx`, `editorial/Rosette.tsx`,
  `ShareCard.tsx`, `ParentTips.tsx`, `NintendoPlaytimeWidget.tsx`, `ImportModal.tsx`
- `src/app/layout.tsx` (metadata/title/OG), `src/app/[locale]/_components/*`
  (Standfirst, FrontPageGrid, DeskRow, TodaysReview)
- Page-level brand strings: `page.tsx`, `faq`, `press`, `partners`, `methodology`,
  `terms`, `privacy`, `login`, `game/**`, `platform/**`, `blog`, `guides`, `age`
- **Assets:** rename `public/lumikin-*.svg` → `ludoverdi-*.svg` and `src/app/icon.svg`
  (SVG contents already redesigned to the editorial nameplate); update ~6 refs
  (`press`, `methodology`, `feed.xml`, `feed.json`).

### B. i18n (5 locales)
- `messages/{en,de,es,fr,sv}.json` — ~70 `LumiKin` hits each. Brand token is
  language-invariant → scripted exact replace `LumiKin` → `Ludoverdi`, **then spot-check
  per locale** (sv/translation quality has bitten before).
- **Do NOT touch `LumiScore`** strings (~29/locale) — metric stays.

### C. Infra / SEO / config
Real `lumikin` config targets (the 4,191 lowercase count is ~95% generated reports/CSV —
out of scope):
- `next.config.js`, `vercel.json`, `.env.example`, `cloudbuild.yaml`, `package.json`,
  `.vercel/project.json`, `.gitignore`
- `src/app/robots.ts`, `src/lib/sitemap/build.ts`, `feed.xml`, `feed.json`,
  `src/app/api/og/**`, `src/lib/methodology.ts`, `src/app/layout.tsx`
- JSON-LD `url`/`logo`/`sameAs`: `page.tsx`, `partners/page.tsx`, `press/page.tsx`
- **External coordination (cannot do from code — checklist):**
  `NEXT_PUBLIC_SITE_URL`, OAuth redirect URIs (`src/auth.config.ts`), Plausible domain,
  GCS bucket (`src/lib/gcs.ts`), Sanity project/dataset (`sanity.config.ts`), DNS, email/socials.

### D. Content & docs
- `content/methodology/v1.0.mdx`, `v1.1.mdx`; regenerate methodology PDF
  (`scripts/generate-methodology-pdf.ts`, filename `lumikin-methodology-*.pdf`)
- Editorial drafts in `docs/redesign/editorial-drafts/*`
- `CLAUDE.md` (project name)

### E. DO NOT touch
- DB column `curascore`; `reports/*`, `docs/gsc/*`, `docs/archive/*`, `scripts/archive/*`
  (historical artifacts). The legacy `Cura*` footprint is the *old* internal name — leave it.

## Sequencing & risk

- **One branch.** Commit A+B together (the visible rename must land atomically — never ship a
  half-renamed UI). C as a second commit, D as a third.
- **Highest risk:** OAuth redirect URIs + `NEXT_PUBLIC_SITE_URL`/canonical. Domain, env, and the
  301 redirect must flip together or login/SEO breaks.
- **Verify:** typecheck + build; grep that zero `LumiKin` remain in `src/` + `messages/`
  (LumiScore intentionally remains); manual pass on home/game/methodology/press in 2–3 locales.
- **Effort:** ~half a day of edits + i18n spot-checks. Gating dependency is the external/infra
  coordination (DNS, OAuth, Sanity, GCS), not the code.

## Open questions
1. Rename code identifiers (`LumiScoreHero`, asset filenames) now, or leave internal?
2. Confirm whether GCS bucket / Sanity project / Plausible are actually named `lumikin` or
   already neutral (grep configs to verify).
3. `.se` + `.kids` defensive registrations — buy alongside `.com`/`.org`?
