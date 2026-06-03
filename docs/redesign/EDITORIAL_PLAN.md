# LumiKin redesign plan — Monocle-leaning editorial

## Goal
Replace the current AI-SaaS visual language with an editorial language that reads as **trusted authority** while keeping the **scannable data spine** of the current product (top-line verdict, drill-down to per-item scores). Reference: Monocle, The Atlantic, Wirecutter, The Pudding.

Live preview of the direction: `/design-preview` (after `npm run dev`).

## North-star principles (commit to these or the rollout drifts)
1. **Paper, ink, rule, muted** for structure. **Ivy, accent, warm** for verdict semantics only.
2. **Bento boxes → hairlines + typographic groups.** No rounded-3xl containers, no drop shadows, no gradient overlays.
3. **Color earns its place.** Score numerals are colored; backgrounds aren't.
4. **Personality lives in three specific moments** — the rosette, the margin annotation, the photography. Nowhere else.
5. **Editorial discipline is what makes the soul moments land** — resist adding "fun" elements outside the three sanctioned spots.

---

## Phase 0 · Foundation lock-in (1–2 days)
Goal: nothing further can drift if the foundation is sound.

- [x] Tokens: `paper`, `ink`, `rule`, `muted`, `accent`, `ivy`, `warm`.
- [x] Fonts: Fraunces (display), Inter (UI/body), Caveat (annotations).
- [x] Type scale: `text-kicker`, `text-display-sm/display/display-lg`.
- [x] `EditorialMasthead` skeleton.
- [x] `EditorialRosette` SVG placeholder.
- [ ] **Decision: rosette art direction.** SVG geometry → real hand-drawn illustration. Either commission one, or use a vintage-stamp style we can extend (recommends / caution / pending / kid-favorite). Deferred to Phase 7 — placeholder SVG (now `currentColor`, evening-compatible) holds the slot.
- [ ] **Decision: photography grade.** Lean CSS filter chain. Deferred — Round A uses inline gradient stand-ins; formalize in Round C when real photos land.
- [x] **Decision: dark mode → option B (evening edition).** Implemented in Round A as a CSS-variable scope (`.evening`) backed by `globals.css` token overrides. Independent of `next-themes`; toggle lives in the design-preview chrome strip.
- [ ] **Decision: locale handling for masthead.** Deferred to Round B (`editorial.*` i18n namespace seed).

---

## Phase 1 · Game detail page (the product) — 1 week
Highest traffic, highest signal. Forces every decision. Ship this first.

Files affected:
- `src/components/GameCard.tsx` (rebuilt — currently 985 lines, will lose ~30%)
- `src/components/LumiScoreHero.tsx` (subsumed by new verdict strip)
- `src/components/ScoreMetaLine.tsx` (restyled to italic byline form)
- `src/components/DarkPatternPills.tsx` (becomes hairline-bordered definition list)
- `src/components/ShareCard.tsx` (already on backlog — redesign in editorial style at the same time, see memory: `backlog_sharecard_i18n`)
- `src/components/ComplianceBadges.tsx` (small-caps inline notation, not badge pills)

Layout deliverables (mirror the v2 mock on `/design-preview`):
1. Hero photo + rosette stamp + title block (3-col grid).
2. Verdict strip: BDS numeral (ivy), RIS numeral (accent), daily limit, age guidance.
3. Per-child line: italic editorial with ✓/✗ glyphs.
4. Two-column main: score tables (2/3) + margin annotation (1/3).
5. Editorial tabs (Simplified / Full scores / Debate transcript).
6. Heads up section — hairline rows with ink-line icons.
7. Meta footer with methodology link.

Special cases that still need a home:
- **Bundled-online warning** (GTA V, RDR2, Minecraft) — becomes a hairline-bounded standalone note above scores, accent-red kicker, no red box. See memory: `backlog_bundled_online_blog`.
- **Virtual currency banner** — folded into heads-up list with warm-amber icon.
- **Debate transcript** — moved into the editorial tab strip, opens inline.
- **Propaganda level / Bechdel** — editorial sub-section after scores, hairline-framed, no pastel boxes.

Risks:
- Mobile: 4-col verdict strip needs to stack 2×2; rosette needs to shrink and re-anchor; margin annotation collapses inline with an accent vertical rule.
- Some users have memorized the current color-coding (emerald = good, red = bad). The ivy/accent semantic mapping preserves the meaning but with less saturation — flag in release notes.

---

## Phase 2 · Listing & browse — 3 days
Files affected: `src/app/[locale]/browse/page.tsx`, `src/app/[locale]/discover/page.tsx`, related listing components, `src/app/[locale]/_components/FeaturedGame.tsx`.

- 3-up grid of editorial listing cards (matches mock on `/design-preview`).
- Replace carousel chrome with hairline-bordered sections + small-caps section headers.
- Filters become a left-column editorial sidebar: italic labels, hairline-bordered checkboxes, no pill chips.
- Pagination: small-caps `← PREVIOUS · 1 / 24 · NEXT →` typographic strip, no buttons.
- Fixes memory: `backlog_browse_lcp` in passing (the empty `alt` carousel-thumb LCP issue) — new listing card has a properly-attributed hero image.

---

## Phase 3 · Homepage — 3 days
Files: `src/app/[locale]/page.tsx`, `src/app/[locale]/_components/FeaturedGame.tsx`, hero section, stat strips.

- Rip out `hero-gradient` animation (`src/app/globals.css`).
- Replace with: editorial masthead → "TODAY'S REVIEW" featured spread (Monocle cover treatment) → editorial section ("WHAT WE'RE TRACKING") with 3 latest reviews → "BY THE NUMBERS" data spread (homepage stats but as a Pudding-style annotated chart) → "GUIDES" stack.
- Search bar: replaces the gradient hero search with a hairline-bordered classified-ad-style input ("Search 6,400 reviews →").

---

## Phase 4 · Global chrome — 2 days
Files: `src/components/SiteNav.tsx`, `src/app/[locale]/layout.tsx` (footer), `src/components/CookieNotice.tsx`, `src/components/BetaBanner.tsx`, `src/components/LanguageSwitcher.tsx`, `src/components/ThemeToggle.tsx`, `src/components/SearchBar.tsx`.

- **Replace `SiteNav` with `EditorialMasthead`** (or absorb the smart bits — hide-on-scroll, search-on-homepage focus — into the masthead).
- Footer redo: matches masthead, double rule top, small-caps section links, copyright italic muted.
- BetaBanner: small-caps accent-red kicker bar above the masthead, hairline-bounded.
- CookieNotice: hairline-bordered tray at bottom, italic body, no card.
- LanguageSwitcher: italic dropdown, not pill.
- ThemeToggle: removed if Phase 0 decision is A.

i18n: extend `nav.*` namespace; add `editorial.dateline.format` per locale (`SUN · 17 MAY 2026` vs `SÖ · 17 MAJ 2026`).

---

## Phase 5 · UGC pages (Roblox, Fortnite Creative) — 2 days
Files: `src/app/[locale]/game/roblox/[experienceSlug]/page.tsx`, `src/app/[locale]/game/fortnite-creative/[mapSlug]/page.tsx`, related card components.

- Reuse editorial detail-panel layout from Phase 1.
- Pending UI gate (from memory: `project_ugc_structured_pipeline`) becomes an italic editorial banner: *"We're still verifying this experience — scores below are provisional."* with hairline rule.
- Score floors (memory: `project_experience_score_floors`) — no visual change needed; floors apply at the data layer.
- Confidence indicator: small italic line in the meta footer.

---

## Phase 6 · Supporting pages — 3 days
- `learn`, `methodology`, `compare`, `privacy`, `terms`, `dashboard`, `discover/*`.
- Most of these are mostly text — easy wins. Apply: paper bg, Fraunces display headers, prose at `max-w-prose`, italic byline beneath h1, hairline section breaks.
- `methodology` becomes a long-form editorial piece — perfect for first-letter drop-cap treatment.
- `compare` is the trickiest — side-by-side score tables. Use the table style from the detail panel, two columns of ScoreTable per game.

---

## Phase 7 · Illustration & decorative assets — ongoing
- Real rosette artwork (recommends / caution / pending / kid-favorite / age-gated).
- Section dingbats / asterisms between long-form content blocks (an editorial fleuron beats a horizontal rule).
- A small illustrated "About the editors" mark for bylines.
- Sparkline/chart treatment for the homepage "BY THE NUMBERS" spread.
- This phase runs in parallel with all others — start finding an illustrator in Phase 0.

---

## Phase 8 · Cleanup — 1 day
- Delete `hero-gradient` and `stat-shimmer` from `src/app/globals.css`.
- Delete dark-mode classes (if decision A).
- Delete unused color tokens in `src/components/GameCard.tsx` (the emerald/orange/yellow/violet pastel palette).
- Remove `lucide-react`'s "icon in a colored circle" pattern across the app — keep icons, lose the chip.
- Strip `rounded-3xl`/`rounded-2xl` from container chrome. Keep on photos/inputs only (or kill there too, depending on taste).

---

## Rollout strategy

**Branch + feature flag.** Create `redesign/v2-editorial` branch. Wrap the new layouts in a `?editorial=1` query param (or `NEXT_PUBLIC_EDITORIAL_V2` env flag) so production data can be previewed in editorial layouts before cutover. Once Phase 1–4 are merged behind the flag and look right with real DB data, flip the flag globally and delete the old paths in a follow-up PR.

**Don't ship piecemeal to prod** — the visual languages don't coexist gracefully on the same site. Either everything is editorial or nothing is.

**Order recommendation:**
```
P0 (foundation)
  ↓
P1 (game detail)  ← forces every decision, derisks the rest
  ↓
P2 + P3 (browse + home, in parallel)
  ↓
P4 (chrome)
  ↓
P5 (UGC) + P6 (supporting pages)
  ↓
Flag flip → P8 cleanup → ship
```

**Timeline estimate:** ~3 calendar weeks at one focused dev. Phase 7 (illustration) runs alongside and might extend beyond the flag flip — placeholder SVG rosette holds the slot.

---

## Out of scope (deliberately)
- Editorial *content* itself (real bylines, real article voice, photo sourcing). The plan is the *visual frame*; the editorial substance is its own project.
- Replacing photography across 6,400 game entries. Per-game photo grading happens via CSS filter for now.
- Mobile-specific rethinks beyond responsive collapse. A native-feeling mobile experience is a separate effort.
- Component library extraction. Build inline first; extract only when the same shape appears 3+ times.

---

## Open questions that block Phase 0
1. Hand-drawn rosette vs. SVG-geometric — yes/no, and if yes, who illustrates?
2. Dark mode A or B?
3. Branch name + feature flag mechanism — query param or env flag?
4. Is the per-locale date formatting needed at launch (Swedish/German/etc.) or English-only acceptable for v1?

---

## Inventory of what already exists on `master`
Foundation pieces already committed and viewable at `/design-preview`:

- `tailwind.config.ts` — editorial color tokens point at CSS variables (Round A) so `.evening` can scope-invert.
- `src/app/globals.css` — editorial palette as CSS variables under `:root` (morning) and `.evening` (evening edition).
- `src/app/layout.tsx` — Fraunces + Caveat loaded as CSS vars alongside Inter.
- `src/components/EditorialMasthead.tsx` — masthead skeleton.
- `src/components/EditorialRosette.tsx` — placeholder SVG rosette, now `currentColor`-driven (recommends + caution variants).
- `src/app/design-preview/DesignPreviewShell.tsx` — client wrapper, MORNING/EVENTIDE toggle, localStorage persistence.
- `src/app/design-preview/page.tsx` — preview sections: article hero, austere detail panel + listing card grid, Monocle-leaning detail panel (standard / bundled-online / UGC pending), homepage cover spread, editorial search input, compare two-column. Inline editorial icon set (6 line-art glyphs) and `EditorialSearchInput` primitive — both graduate to `src/components/editorial/*` in Round B.
- `src/middleware.ts` — `/design-preview` excluded from locale rewriting.

None of these touch production routes. Safe to delete the preview route + middleware exclusion when the redesign branch lands.

---

## Round A · status

**Done — committed to `master`.** All Phase 0 visual sketches that Phase 1 depends on are settled in `/design-preview`. Open Phase 0 decisions still listed above are deferred to later rounds (rosette art → Phase 7, photography grade → Round C, masthead i18n → Round B). Next step: cut `redesign/v2-editorial` branch off `master` and start Round B (primitive extraction).
