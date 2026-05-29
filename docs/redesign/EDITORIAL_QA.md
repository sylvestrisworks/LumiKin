# Editorial QA — checklist for AI-drafted long-form

Applies to: `guide` and `post` documents in Sanity (`/guides/[slug]`, `/blog/[slug]`).
**Not** applied to the per-game/UGC `<GameFAQ />` component or the methodology
sections on `/faq` — those are template-driven and verified once at template time.

This checklist exists because the 2026-05-23 translation audit flagged Gemini for
hallucinating content and dropping game titles. Long-form prose multiplies that
risk. Every piece below must pass before it leaves draft status in Sanity.

## Hard pass/fail — block publish

- [ ] **Every game claim is grounded in the DB.** Scores, ages, mechanics,
      monetization flags, ESRB/PEGI ratings, prices, platforms — verified against
      `games` + `gameScores` (and `platformExperiences` + `experienceScores` for
      UGC). If a claim isn't in the DB, either it's cut or a real source URL is
      cited. No inferred-feeling-true claims.
- [ ] **Every citation has a real, live URL.** Research papers, regulator
      decisions, news pieces. Open each link before publish. PMC, AAP, WHO,
      regulator domains preferred over secondary coverage.
- [ ] **Gaming-positive tone.** Per CLAUDE.md and `docs/RUBRIC.md`: benefits
      first, risks framed as something to manage — never as reasons not to play.
      No "screens rotting brains" framing. No "experts warn" hedges that imply
      consensus where there isn't one.
- [ ] **Specific game/product names preserved verbatim** through translation.
      The Swedish audit found Gemini dropping titles entirely; spot-check that
      "Fortnite", "Roblox", "Minecraft" appear in the translated copy at the
      same density as the English source.
- [ ] **No invented statistics.** If a stat is in the piece, the source URL is
      next to it. "Studies show 70%…" without a citation is cut.

## Linking rules — also block publish

- [ ] **Guides link down to ≥3 specific `/game/[slug]` (or UGC) pages**, by
      slug. The `/game/foo` should be a game directly relevant to the guide's
      thesis, not filler.
- [ ] **Guides link laterally to ≥2 sibling guides** in the same or adjacent
      `guide.category` bucket.
- [ ] **Blog posts link to ≥1 guide** (the relevant pillar).
- [ ] **Anchor text is descriptive**, never "click here" / "read more". The
      anchor text should be the destination page's parent-intent phrase.

## SEO hygiene

- [ ] `seoTitle` leads with the parent-intent question or verb. The pattern is
      `<answer or question> · LumiKin`, e.g.
      `Best games for age 10 — picked by a child-development rubric · LumiKin`.
- [ ] `seoDescription` is ≤155 chars and includes the parent-intent phrase at
      least once. No keyword stuffing.
- [ ] Hero/cover image has a **written** `alt` field. Not auto-generated.
- [ ] Internal anchor structure: one H1 (the title), H2s for top-level sections,
      H3s for sub-points. No heading-skipping.

## Tone & framing

- [ ] **The lede answers a parent question within 2 sentences.** Not "in 2018
      researchers began noticing…" Not "video games have come a long way…"
- [ ] **No fear-shopping.** If risks are listed, every risk is paired with
      either (a) what to do about it, or (b) the context in which it does/does
      not apply.
- [ ] **Voice is one operator + a rubric**, not a corporate "we at LumiKin".
      Personal where useful, factual where not.

## Translation discipline (EN → SV → FR → DE)

EN must pass this whole checklist before any translation begins.

- [ ] Translation runs through the **slow, strict** prompt — not the bulk
      `translate-content` cron (see `feedback_translate_cron_field_gaps`).
- [ ] After translation, the piece lands in Sanity **as a draft**, not
      published. Never auto-publish translations.
- [ ] Run `judge-sv` (or equivalent) on the Swedish translation before
      publishing. Reject and retranslate on any "drops title", "hallucinates
      claim", or "inverts meaning" finding.
- [ ] Spot-check anchor-text translations — the link target slug stays English,
      but the anchor text is localized.
- [ ] Locale-specific vocabulary: SV uses *åldersgräns* for age rating, DE uses
      *Altersfreigabe*. Both must appear in the translated piece if the EN
      source uses "age rating" / "age limit".

## When a piece fails

- Fix and re-run the failing checks before publish. **Don't loosen the
  checklist** — the checklist tightening lever is reserved for cases where a
  piece passes every check and still ships a problem; then the checklist
  itself needs another row.
- If the same author/draft fails ≥3 times in a row, the failure isn't the
  piece — it's the prompt or the source. Fix that before drafting more.
