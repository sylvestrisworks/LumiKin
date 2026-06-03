---
sanityType: post
locale: en
slug: how-we-score-roblox-and-fortnite-creative
postType: blog
title: "How we score Roblox experiences and Fortnite Creative maps"
excerpt: "The same kid plays a hundred different games under one platform's logo. Here is how LumiKin rates each experience separately — and the confidence gate that stops us from rating ones we can't see clearly."
seoTitle: "How LumiKin scores Roblox and Fortnite Creative experiences | LumiKin"
seoDescription: "Methodology behind LumiKin's per-experience ratings on Roblox and Fortnite Creative — the rubric, the input-confidence gate, and how they fit together."
publishedAt: 2026-05-29
siblingGuides:
  - bundled-online-modes
  - voice-chat-and-stranger-contact
---

# How we score Roblox experiences and Fortnite Creative maps

When a kid says "I was playing Roblox", they were almost certainly not playing Roblox. They were playing one of millions of experiences hosted on Roblox — the same way "I was on YouTube" doesn't tell you which channel. Roblox is a runtime; Fortnite Creative is another. The actual product that affects your child for the next hour is the experience inside.

This is a short post on how LumiKin rates those experiences individually, and on the deliberate gate that stops us from giving a score when we can't see the inside clearly.

## Why a platform-level score isn't enough

[Roblox](/en/game/roblox) and [Fortnite Creative](/en/game/fortnite-creative) get LumiScores at the platform level — they describe the shared monetisation, the chat infrastructure, the parental controls, and the kind of stranger contact possible across every experience on the platform. Those scores answer the question "is the platform itself something we want our kid on?"

But the experience matters more than the platform. A child-friendly cooperative escape room on Fortnite Creative has the same Robux infrastructure as a competitive PvP map full of voice chat — but the design pressures, the time pull, and the social risk are completely different. Rating the platform tells you that battle passes exist; it doesn't tell you whether *this* island uses them.

So every experience gets its own score, against the same rubric we use for standalone games — adjusted for the UGC reality.

## What we score on each experience

Six dimensions, each on a 0–3 scale, that combine into the per-experience LumiScore:

- **Creativity / Learning / Social play** — the developmental benefits side. Does this experience build something or teach something a kid would actually use outside the game?
- **Dopamine traps** — variable rewards, streaks, FOMO mechanics specific to the experience (not the host platform).
- **Toxicity** — the social tone of the actual lobby this experience produces, not the platform's chat infrastructure in general.
- **UGC content risk** — for Roblox especially, what user-generated content can a player encounter inside this place?
- **Stranger risk** — how exposed is a player to anonymous strangers within this experience?
- **Monetisation pressure** — Robux pulls, V-Bucks pulls, season-pass pressure attached to this specific experience.

These feed the same time-recommendation formula we use everywhere else. *[Duo Escape Room: A Tale For Two](/en/game/fortnite-creative/fortnite-9502-5427-0647)*, for example, comes out at LumiScore 63/100 with a 90-minute recommendation for age 12+ — a cooperative escape map's design profile is closer to a puzzle game than to a battle royale.

## The confidence gate

UGC scoring has a problem that standalone-game scoring doesn't: the information we can get about an individual experience is often thin. A new Roblox place with five visits and a one-line description does not give the rubric enough to work with, and Gemini is happy to make something up if you let it.

So we attached a **confidence gate** to every experience score. Each scoring run produces an `inputConfidence` value (0–1) reflecting how rich the input was: how much description, how many tags, how many creator signals, how stable the gameplay data. Below a threshold, we don't show a score.

You will see this on the site as "Not enough info to rate yet" on a low-confidence experience page. The page still exists — title, thumbnail, creator — so parents can find what their kid is talking about. We just decline to put a number on it that we can't defend.

Roughly: high-confidence experiences ship a public score; low-confidence ones wait for more data, a manual review, or a future re-score when the source material is richer. We would rather show nothing than hallucinate a number.

## What this means in practice

Three things if you are using the per-experience pages:

1. **Search by experience name, not by platform.** "Brookhaven" or the island code on Fortnite Creative will get you to the actual product your kid is playing.
2. **Treat the platform parent guides as background**, not as the answer. The orange-bordered panel on every Roblox page and the blue-bordered one on every Fortnite Creative page give you the platform-wide context; the per-experience score gives you the actual answer.
3. **Tell us what's missing.** Every experience page has a feedback link. UGC catalogue gaps and miscored experiences are the single biggest input we get into the re-scoring queue.

## Read next

- *[Bundled online modes: GTA V, RDR2, and Minecraft](/en/guides/bundled-online-modes)* — the standalone-game cousin of this problem, where an online mode hides behind a single-player launcher.
- *[Voice chat, party chat, and stranger contact](/en/guides/voice-chat-and-stranger-contact)* — the social-risk dimension that dominates UGC scoring more than anywhere else.
- *[The LumiScore rubric in full](/en/faq#curascore)* — the underlying formula behind every per-experience number.
