---
sanityType: guide
locale: en
slug: how-much-game-time-by-age
category: screen-time
title: "How much game time is actually healthy, by age"
excerpt: "WHO and the AAP don't give you a clean hourly cap past age 5. So we built one — based on how the game is designed, not how long it runs."
seoTitle: "How much game time is healthy by age — the LumiKin model | LumiKin"
seoDescription: "A clear, age-by-age screen-time framework grounded in WHO and AAP guidance plus the LumiScore time formula. Why one game-hour isn't equal to another."
publishedAt: 2026-05-29
siblingGuides:
  - bundled-online-modes
  - voice-chat-and-stranger-contact
---

# How much game time is actually healthy, by age

If you have ever tried to find a clean number from a credible source for "how much gaming is okay for a nine-year-old", you have probably noticed something: nobody will give you one. The World Health Organization doesn't, the American Academy of Pediatrics doesn't, no Nordic public-health authority does. They all converge on a single answer that is *correct but very annoying*: it depends on the game.

So we built a number, and we built it so that it does depend on the game. This is how it works.

## What the public-health guidance actually says

The two most-cited sources are unambiguous in the early years and deliberately fuzzy after that.

- The **World Health Organization** ([2019 guidelines](https://www.who.int/news/item/24-04-2019-to-grow-up-healthy-children-need-to-sit-less-and-play-more)) recommends *no sedentary screen time* for children under 2, and *no more than 1 hour* of sedentary screen time per day for ages 2–4, less being better.
- The **American Academy of Pediatrics** ([Media and Young Minds, 2016](https://publications.aap.org/pediatrics/article/138/5/e20162591/60503/Media-and-Young-Minds) and the [Center of Excellence FAQ](https://www.aap.org/en/patient-care/media-and-children/center-of-excellence-on-social-media-and-youth-mental-health/qa-portal/qa-portal-library/qa-portal-library-questions/screen-time-guidelines/)) recommends the same hour cap for ages 2–5, and from 6 onward stops giving an hourly cap entirely. The recommendation becomes: keep sleep, physical activity, and family time intact, and make a written family media plan.

That second move — from hard cap to "make a plan" — is the gap LumiKin is built to fill. From age 6 onward, the only honest answer is *it depends on the game*, but most parents need something more actionable than that to settle the question on a Wednesday evening.

## Why a generic cap is wrong

Here is the case for refusing to give you a one-size number. Two games, same hour:

- An hour of *[Minecraft](/en/game/minecraft)* in a single-player world. Spatial planning, resource management, building, problem-solving. No notifications, no streaks, no monetisation in the base game. Our rubric scores this BDS 0.60, RIS 0.14 — high benefit, near-zero manipulation. The recommended cap is up to 2 hours per day.
- An hour of a free-to-play mobile match-three with a daily streak, an energy system, and a battle pass. The same hour, maybe even the same kid. *[Monopoly GO!](/en/game/monopoly-go)* is the canonical example — BDS 0.14, RIS 0.73, LumiScore 18, recommended *not for children*.

The hour is identical on the clock. The hour is not identical in the brain. Any framework that puts both into the same bucket is doing your kid a disservice in opposite directions: it under-rates the good game and over-rates the bad one.

## The LumiKin time-recommendation formula

We calculate two numbers per game from a public rubric — the **Benefit Density Score (BDS, 0–1)** and the **Risk Intensity Score (RIS, 0–1)**. The base session length is read off the RIS:

| RIS | Base recommendation |
|---|---|
| 0.00 – 0.15 | Up to 120 min/day |
| 0.16 – 0.30 | Up to 90 min/day |
| 0.31 – 0.50 | Up to 60 min/day |
| 0.51 – 0.70 | Up to 30 min/day |
| 0.71 + | 15 min or not recommended |

Then two adjustments are applied:

- **BDS ≥ 0.60** (substantial developmental value) extends the recommendation by one tier — unless RIS is above 0.70, in which case high risk overrides the bonus.
- **BDS < 0.20 and RIS > 0.30** (low value, moderate risk) drops the recommendation by one tier.

The asymmetry is deliberate: real developmental benefit earns more time, but it never overrides a very high-risk design.

## Age adjustments, applied last

The numbers above are calibrated for ages 6–12. We then adjust:

- **Under 6.** Recommendation is halved and capped at 30 min/day, regardless of the game. This aligns with the WHO/AAP one-hour total-screen ceiling.
- **6–9.** Applied as-is.
- **10–12.** Applied as-is, with notes on co-play where the game's social risk is elevated.
- **13–17.** Extended one tier for age-appropriate content. Teens benefit from autonomy with guardrails more than from arbitrary limits.

So a teen playing *[Red Dead Redemption 2](/en/game/red-dead-redemption-2)* (BDS 0.56, RIS 0.00, content-rated 17+) gets a 2-hour-tier recommendation — not because the game is short, but because the design isn't trying to pull them back in. A teen playing a game with the same content rating but a high RIS would get half that, for the opposite reason.

## What to do with the number

Three rules of thumb after the formula does its work:

1. **Don't budget time across games.** "He had 20 minutes of *Brawl Stars*, so he gets 100 of *Minecraft*" is not how this works. Each game's recommendation is its own thing, because the design pressures are different. Allow the high-benefit, low-risk games more space and the others less.
2. **Watch the stopping points, not the clock.** Games with no natural breaks (endless runners, daily timers, infinite-scroll level lists) are harder to leave than games with chapter beats. Time limits feel like punishment in the first kind and like normal endings in the second.
3. **Look at the week, not the day.** Public-health guidance is much more comfortable with a few high-quality hours on a Saturday than with a stressed-out daily check-in on a school night. The LumiScore time recommendation is a daily ceiling, not a daily target.

## Read next

- *[Bundled online modes: why GTA V, RDR2, and Minecraft score the way they do](/en/guides/bundled-online-modes)* — what happens when a great single-player game ships with a not-great online one.
- *[Voice chat, party chat, and stranger contact](/en/guides/voice-chat-and-stranger-contact)* — the social-risk dimension that drives a lot of online-multiplayer RIS.
- *[How the LumiScore is calculated](/en/faq#curascore)* — the full rubric behind every number above.
