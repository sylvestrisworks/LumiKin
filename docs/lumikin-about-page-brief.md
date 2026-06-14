# Claude Code Brief — Founder/Author presence: About page, Person schema, bylines

**Goal:** Establish a named, accountable editor behind Lumikin without tipping into "influencer" framing. Deliver (1) an About page, (2) machine-readable `Person` entity proof via JSON-LD `sameAs`, and (3) a reusable byline component for the methodology page and editorial pieces. Credibility rests on method + independence, with the founder as the accountable architect — not as the source of authority.

**Working style:** Propose the file/route plan and component API before implementing. Do not write final code until I confirm the structure. Flag anything that conflicts with existing schema/SEO conventions in the repo.

---

## Phase 0 — Audit first (no changes)

Before writing anything, report back:

1. Existing JSON-LD: where is `Review` / `Organization` schema currently emitted? Component, layout, or per-route? Is there already an `Organization` or `WebSite` node a `Person` should link to via `founder` / `author`?
2. Existing routes: is there an `/about`, `/methodology`, or author concept already? Any byline rendering today?
3. i18n: how are static editorial strings handled (the About copy is long-form prose — confirm whether it lives in message catalogs or as MDX/route content)?
4. Where do canonical/stable URLs get defined (needed for the `Person` `@id` and `mainEntityOfPage`)?

Output a short findings note + proposed plan, then stop for confirmation.

---

## Phase 1 — About page copy

Create the About page (`/about` unless audit suggests otherwise). This is the **warm, first-person** version. Render as long-form prose, institutional tone (NYT/Wirecutter register), no CTA button, single column, generous measure.

> I bought my first console with my own money in 1989, when I was ten and my parents were quietly convinced video games were a waste of a good childhood. One of the first games I loved was the original *Zelda*. My English wasn't good enough to figure out the save function, so for a long time I simply started from the beginning every time — and kept playing anyway. That tells you most of what you need to know about how I feel about this medium.
>
> I've been console-fluid ever since — PlayStation, Xbox, four generations of Nintendo in the house — though these days I mostly play on PC. I still believe the best narrative games sit comfortably next to good books in what they can do to you.
>
> Then I had children, and I wanted them to play. I've never seen games as a threat to manage; I see them as something that, chosen well, genuinely helps a young mind grow. But "chosen well" turned out to be the hard part. The tools available to me could enforce screen-time limits and allow-lists, and they did — but all they really gave our household was conflict. They could tell me *how long*, never *which games, and why*. A blocker assumes every game is a risk to be contained. What I actually needed was a way to tell a game that builds something from a game engineered to extract something.
>
> So I built it. The deeper I went, the clearer it became that games are not interchangeable — that the distance between a title that develops real skills and one designed to exploit attention is enormous, and almost completely invisible to the parent standing in the doorway. What changed our home wasn't a stricter limit; it was a shared, honest read of a game's actual benefits and risks, and a conversation we could both stand behind.
>
> I came to this as a journalist with a background in anthropology, which is to say I'm in the habit of sourcing claims carefully and of observing — systematically, without flinching — how people behave inside the systems built for them. Games are exactly that: systems, and culture. Lumikin is what happens when you turn that lens on them in the service of parents who like games and want to choose well.

**Collaborator seam:** leave a clearly-commented insertion point as the closing paragraph for a future named academic collaborator. Do not invent one. Comment example:
`{/* COLLABORATOR_SEAM: closing line introducing named academic advisor once secured */}`

---

## Phase 2 — Credentialed copy (methodology / partners byline block)

This **third-person** block is the author/editor statement for the methodology page and partners page. Shorter, method- and independence-led.

> Lumikin is built and edited by Johan Sjöstedt, a journalist with a background in anthropology who applies sourcing discipline and systematic observation to a question the established rating bodies structurally cannot answer: not whether a game is *appropriate*, but whether it is *worth a child's time* — and which specific experiences inside today's platforms actually are.
>
> The methodology is grounded in peer-reviewed developmental psychology rather than personal opinion, and it weighs benefit against risk rather than simply flagging danger — because parents who value games need discernment, not just restriction. Lumikin is independent: it takes no funding from the platforms it rates or from the parental-control vendors it works with, and every score carries a named, accountable editor behind it.

**Collaborator seam:** insertion point right after the methodology sentence.

---

## Phase 3 — `Person` JSON-LD + `sameAs`

Emit a `schema.org/Person` node for entity disambiguation (human proof-of-personhood + machine-readable citation-worthiness for AI Overviews / knowledge graph). Link it to the existing `Organization` node via `founder`, and reference it as `author` on the methodology page and editorial bylines.

```ts
// Proposed shape — wire URLs from a single config constant, not hardcoded per page.
// I (Johan) will supply the real sameAs URLs; leave them as typed placeholders for me to fill.
const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://lumikin.org/about#johan-sjostedt", // stable @id, reused as author reference
  "name": "Johan Sjöstedt",
  "jobTitle": "Founder & Editor",
  "description":
    "Journalist with a background in anthropology; founder and editor of Lumikin, an independent, research-grounded child-safety game rating platform.",
  "knowsAbout": [
    "video game ratings",
    "child development",
    "media literacy",
    "dark patterns in games",
  ],
  "sameAs": [
    // FILL: LinkedIn profile URL
    // FILL: journalism portfolio / byline page URL  <-- highest-value entry, list first if present
    // FILL: Instagram profile URL (optional)
  ],
  "worksFor": { "@id": "https://lumikin.org/#organization" }, // must match existing Organization @id
};
```

Requirements:
- Single source of truth for the URLs (one config/constant), imported wherever the node is emitted.
- On `Organization`, add `"founder": { "@id": ".../about#johan-sjostedt" }`.
- On the methodology page, set `"author": { "@id": ".../about#johan-sjostedt" }` and `mainEntityOfPage`.
- Confirm the `@id` values match whatever the audit found; do not create duplicate Organization nodes.
- Validate output against Google Rich Results / schema validator; report any warnings.

---

## Phase 4 — Byline component

Reusable component rendering the visible human byline on the methodology page and editorial/Analysis pieces. Visual byline + the `author` schema reference should come from the same source so they can't drift.

Proposed API (confirm before building):

```tsx
<AuthorByline
  variant="full" | "compact"   // full = methodology/about footer; compact = editorial pieces
  showIndependenceNote?: boolean // renders the "independent, no platform/vendor funding" line
/>
```

- `full`: name, "Founder & Editor", one-line credential ("journalist with a background in anthropology"), optional independence note.
- `compact`: "By Johan Sjöstedt, Founder & Editor" + link to `/about`.
- No avatar/photo dependency required to ship; if a portrait is added later it should be optional, not assumed.

---

## Acceptance criteria

- [ ] `/about` renders the warm copy, no CTA in hero, institutional single-column layout, collaborator seam present and commented.
- [ ] Methodology + partners pages render the credentialed block with its collaborator seam.
- [ ] `Person` JSON-LD validates with no errors; `sameAs` reads from one config with clearly-marked FILL placeholders (no invented URLs).
- [ ] `Organization.founder` and methodology `author` both resolve to the same `Person` `@id`; no duplicate nodes.
- [ ] `AuthorByline` renders both variants; visible byline and schema author share one source.
- [ ] i18n handled per repo convention; no hardcoded strings that bypass the catalog if one exists.
- [ ] Independence claim ("no funding from platforms or vendors") appears in the credentialed block only, not bolted onto the warm narrative.

## Out of scope (do not do)

- Do not feature or name any minor / family member anywhere in copy or schema.
- Do not invent social URLs, credentials, or an academic advisor.
- Do not change the homepage in this phase.
