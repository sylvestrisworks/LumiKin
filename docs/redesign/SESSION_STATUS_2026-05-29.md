# Content-plan execution — session status, 2026-05-29

Working from the plan at `~/.claude/plans/radiant-knitting-rose.md` (approved earlier
this session). This note exists so context can be compacted without losing track of
where we are. Bookmarked for the next session.

## Scope recap

User asked to plan and then execute a content strategy for blog posts, parental
guides, and FAQs. Plan was approved with three explicit choices:

- **Scope:** editorial calendar **and** per-game FAQ JSON-LD (both)
- **Authoring:** AI-drafted, human-edited, weekly cadence
- **Locales:** EN first, then SV → FR → DE
- **Permissions:** infrastructure only, no commits, no pushes, no Sanity API writes

## What shipped — code (infrastructure)

All in the working tree, **not committed** per user's instruction.

| File | Change |
|---|---|
| `src/components/GameFAQ.tsx` | NEW — locale-aware server component, renders visible Q&A block + FAQPage JSON-LD |
| `src/app/[locale]/game/[slug]/page.tsx` | Replaced inline EN-only `faqLd` with `<GameFAQ />`; passes `ageRatingLine` |
| `src/app/[locale]/game/roblox/[experienceSlug]/page.tsx` | Same; passes `platformContext="Roblox"`; removed orphan `verdictNarrative()` helper |
| `src/app/[locale]/game/fortnite-creative/[mapSlug]/page.tsx` | Same; passes `platformContext="Fortnite Creative"`; removed orphan helper |
| `src/app/[locale]/faq/page.tsx` | Fetches Sanity `faqItem` documents (categories: general / screen-time / game-safety) and renders them above the hardcoded methodology sections; emits combined FAQPage JSON-LD covering Sanity Q&As + plain-string methodology items |
| `messages/{en,sv,de,fr,es}.json` | New `gameFaq.*` namespace (heading + q1–q4 + a1/a1WithAge + a2/a2WithRatings/a2Ugc + a3/a3Ugc + 4 verdict tiers). New `faq.parentsAskHeading`. SV q2 uses *åldersgräns*, DE q2 uses *Altersfreigabe*. DE `game.metaTitle`/`metaDescFallback` updated to lead with *Altersfreigabe* like SV already led with *åldersgräns* (audit Issue 3 fix) |
| `docs/redesign/EDITORIAL_QA.md` | NEW — per-piece checklist for AI-drafted long-form. Hard pass/fail rules grounded in the 2026-05-23 translation audit findings |

Typecheck: `npx tsc --noEmit` exits 0 after every edit batch.

## What shipped — content drafts (11 pieces)

All in `docs/redesign/editorial-drafts/`. Each file has frontmatter mapping cleanly
to Sanity fields (`sanityType`, `slug`, `category`/`postType`, `title`, `excerpt`,
`seoTitle`, `seoDescription`, `publishedAt`). All pass the automated QA sweep:
seoDescription ≤155 chars, ≥3 game-page links, ≥2 sibling-guide links (or ≥1 for
blog posts). Every score, age, time-label, and ESRB/PEGI rating cited in the drafts
was pulled live from the DB at draft time.

| File | Pillar | Words | Game links | Guide links |
|---|---|---|---|---|
| `guide-bundled-online.md` | game-safety | 901 | 3 | 2 |
| `guide-game-time-by-age.md` | screen-time | 934 | 3 | 2 |
| `post-how-we-score-ugc.md` | blog | 791 | 3 | 2 |
| `guide-esrb-pegi-lumiscore.md` | game-safety | 978 | 5 | 3 |
| `guide-voice-chat-stranger-contact.md` | game-safety | 903 | 3 | 3 |
| `guide-best-games-age-10.md` | age-guide | 1028 | 8 | 4 |
| `guide-loot-boxes-and-battle-passes.md` | game-safety | 1200 | 4 | 4 |
| `guide-what-changes-at-age-13.md` | age-guide | 996 | 6 | 4 |
| `guide-talk-about-a-game-you-dislike.md` | parenting-tips | 1106 | 3 | 3 |
| `guide-enforce-time-limits.md` | parenting-tips | 1105 | 4 | 5 |
| `guide-best-games-age-8.md` | age-guide | 879 | 7 | 5 |

Total: 10 guides + 1 blog post, ~10,800 words.

## Pillar coverage vs. the 12-week plan target

```
Game-safety guides    4 / 5    (missing: VR/motion piece — deferred per rubric v1.2)
Screen-time guides    1 / 3    (missing: one-hour-equal, when-the-limit-bends)
Age-guide listicles   3 / 8    (have: 8, 10, "what changes at 13";
                                 missing: 4–5, 6, 12, 14, 16)
Parenting-tips        2 / 3    (missing: co-playing piece)
Launch blog posts     1 / 8    (have: how-we-score-ugc;
                                 missing: bundled-online announcement, Roblox
                                 safety reaction, methodology piece on ESRB
                                 divergence, summer-break, season reaction,
                                 translation audit, Game Pass families)

TOTAL                11 / 22  pieces drafted
```

## What to do next (pick when context is fresh)

1. **Review the 11 drafts in `docs/redesign/editorial-drafts/`.** Anything that
   needs structural change should be flagged before more drafting — the pattern
   is repeated across all 11 pieces.
2. **Publish path for drafts**: open Sanity Studio (`/studio`), create a new
   `guide` or `post`, paste frontmatter values into matching fields, paste the
   markdown body into the portable-text area. Land as **draft** per
   `EDITORIAL_QA.md`. Do not auto-publish.
3. **Populate `/faq` parent-intent section** by adding `faqItem` documents in
   Sanity under category `general`, `screen-time`, or `game-safety`. Suggested
   starter Q&As are listed in the plan file under "To activate the new /faq
   parent-intent section".
4. **SV translations** — once EN drafts are reviewed, the slow/strict translation
   prompt + `judge-sv` should run on them. Land as Sanity drafts; never auto-publish.
5. **Drafting backlog (if continuing in a future session):**
   - Co-playing guide (parenting-tips — closes the pillar)
   - Bundled-online launch blog post (announcement sister to the existing guide)
   - "Why LumiKin differs from ESRB on \[picked game\]" methodology blog
   - More age-guide listicles (6, 12, 14 highest SEO value)
   - "One game-hour isn't equal to another" screen-time piece
   - "When the time limit should bend" screen-time piece

## Decisions captured along the way

- **Per-game FAQ JSON-LD already existed** but only on `/en/*` and only as
  invisible JSON-LD. The work was to make it visible + locale-aware + present on
  UGC pages, not to build it from scratch.
- **Site `/faq` is hybrid**: hardcoded methodology sections stay (rich React
  content with citation links — Sanity portable text can't represent them
  faithfully); Sanity-driven Q&As are added *above* them for parent-intent SEO.
  Plain-string hardcoded answers are folded into the FAQPage JSON-LD alongside
  Sanity ones.
- **SV uses *åldersgräns*; DE uses *Altersfreigabe*** in FAQ q2 + metaTitle +
  metaDescFallback. This is the audit Issue 3 fix from `docs/seo/2026-05-gsc-audit.md`.
- **Editorial QA discipline** is documented in `docs/redesign/EDITORIAL_QA.md`.
  All 11 drafts conform; the automated QA sweep checks the structural rules.
  Tone/citation rules are human-reviewable only.
- **No drafts are published or pushed**: all 11 are markdown files in
  `docs/redesign/editorial-drafts/`. The user reviews before Sanity ingest.

## Memory entries worth saving when convenient

- *Sanity Studio is fully wired and live* — `post`, `guide`, `faqItem` schemas
  in `src/sanity/schemaTypes/`; project ID `8j5re8qj`, dataset `production`;
  PortableTextRenderer at `src/components/PortableTextRenderer.tsx`.
- *Per-game FAQ infrastructure* is now `<GameFAQ />` consumed by 3 game-page
  templates. Future per-game-page work goes through this component, not inline.
- *Editorial drafts directory* — `docs/redesign/editorial-drafts/` is the
  staging area for AI-drafted long-form before it lands in Sanity. Frontmatter
  format documented in this file.
