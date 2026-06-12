# LumiKin credibility hardening — punch list

You are working in the lumikin.org codebase. The site's product is trust; the issues below were found in a cold external audit (June 12, 2026) and are concentrated on the credibility surface. Work top to bottom — P0 items are launch-blocking for any press, partner, or paid-acquisition push. Before changing anything, locate the relevant source (page templates, content files, data pipeline) and confirm the issue reproduces on the live build.

---

## P0 — Trust-breaking, fix first

### 1. Methodology page ships raw placeholder text
**Problem:** `/en/methodology` renders bracketed template placeholders verbatim, e.g. `[Rationale paragraph 1: What LumiKin measures — describe the dual-profile approach...]` and multiple `[Citations ... To be added.]` blocks. This is on the single page whose job is proving rigor.
**Task:**
- Find the methodology content source (likely MDX/markdown or CMS entry).
- Write the missing rationale paragraphs from the bracketed editorial notes — they already describe the intended argument; expand each into 80–150 words of finished prose in the site's existing voice (plain, confident, parent-facing but precise).
- For the `[Research basis]` blocks: do NOT invent citations. Replace each with a short honest line such as "Research references for this section are being compiled and will appear in methodology v1.2." and add a `TODO(citations)` code comment.
- Grep the entire content tree for `[Rationale`, `[Citations`, `To be added`, `[Versioning policy`, `[Communication policy` and clear every instance the same way.
**Acceptance:** zero bracketed placeholders render anywhere on the site; `grep -rn "\[Rationale\|To be added"` over content returns nothing user-visible.

### 2. Methodology version mismatch (v1.0 vs v1.1)
**Problem:** Homepage links `lumikin-methodology-v1.1.pdf`; `/en/methodology` says "Version 1.0 · Published April 26, 2026" and the changelog contains only 1.0.
**Task:** Determine which version is canonical. Make page header, changelog table, PDF link, and the PDF artifact itself agree. If v1.1 exists, add its changelog row (date + summary of what changed); if it doesn't, point the homepage at the v1.0 PDF. Centralize the version string in one config/constant so this cannot drift again, and have both the page and the PDF link read from it.
**Acceptance:** one version number everywhere; changelog row exists for the displayed version; version sourced from a single constant.

### 3. Absurd/junk scores visible in the Roblox catalogue
**Problem:** `/en/game/roblox` surfaces obvious pipeline failures: "[Place 1] Lua Script Execution" scored **80, 120 min/day** (a script-execution place rated as excellent for kids); junk entries like "Baseplate", "a true baseplate", "smosh"; a creator displayed as the raw ID "Guest_800000000000".
**Task:**
- Add a quality floor to catalogue listing queries: exclude or quarantine entries below a minimum visit/CCU threshold AND entries whose title/creator matches junk patterns (baseplate, test place, free admin, script execution, etc.). Keep their detail pages reachable by direct URL if needed, but don't list them.
- Add a hard rule or denylist category in the scoring pipeline: experiences whose primary function is script execution / free admin / exploitation tooling must never receive a high score — route them to the "Not enough info to rate" / flagged state pending human review.
- Audit the current 166 listed Roblox experiences for other outliers (very high score + very low engagement is the smell). Log findings to a review file rather than silently rescoring.
**Acceptance:** Lua Script Execution and baseplate-class entries no longer appear in the listing; a documented quality-floor function exists with tests; outlier audit log committed.

### 4. Duplicated-word copy bug in platform header
**Problem:** Roblox platform header renders "Not recommended for children recommended" — looks like a recommendation-label string concatenated twice in the template.
**Task:** Find the platform-page score-label component, fix the duplication, and check every score tier label renders correctly on at least one platform and one game page per tier.
**Acceptance:** label renders once, all tiers verified.

---

## P1 — Trust-building, this sprint

### 5. Automation transparency on game pages
**Problem:** The methodology honestly states some scores are `review_tier: automated` (spot-checked, not individually human-verified) — but only in the fine print and API. The Minecraft page shows no such label. Meanwhile "1,703 rated this week" makes the automated pipeline obvious to any sophisticated reader. The honesty exists; it's just not at the point of decision.
**Task:** Surface `review_tier` on every game page as a small labeled badge near the score: e.g. "Automated review — spot-check audited" / "Editor reviewed" / "Community reviewed", each linking to the relevant methodology section. Add the field to the compare view too.
**Acceptance:** every game page displays its review tier; badge links to methodology anchor.

### 6. About / "who is behind this" page
**Problem:** Reviews credit "the LumiKin editors"; there are no names, credentials, or About page in the nav. For child-development claims, anonymity is the biggest remaining trust gap.
**Task:** Create `/en/about` (and translated routes) with: who builds LumiKin, the human + automated review model stated plainly, advisory/credential information if available, contact, and a short independence statement (no paid placements affecting scores). Add to footer and main nav. If real names/bios are needed from the owner, scaffold the page with clearly marked `<!-- OWNER INPUT NEEDED -->` slots rather than inventing people.
**Acceptance:** About page live in all five locales, linked from nav and footer, no invented credentials.

### 7. Ambiguous regulatory-compliance badges
**Problem:** Game pages show `✓DSA ✗GDPR-K ✗ODDS` with a note "Grey = not yet assessed" — so ✗ apparently asserts non-compliance. Publicly asserting Minecraft fails GDPR-K is a legally loaded claim.
**Task:** Change the badge semantics to three explicit states: "Assessed: meets criteria", "Assessed: concerns noted" (with a tooltip explaining what LumiKin checked — frame as LumiKin's assessment of design practices, not a legal determination), and "Not yet assessed". Default every badge that lacks documented assessment evidence to "Not yet assessed". Add a one-line disclaimer under the block: assessments reflect LumiKin's methodology, not legal findings.
**Acceptance:** no ✗ renders without a documented assessment behind it; disclaimer present; tooltip copy explains criteria.

### 8. Wrong developer attribution (data ingestion)
**Problem:** Minecraft lists developer as "4J Studios" (console porting house) instead of Mojang Studios — likely a RAWG field-mapping artifact affecting other titles too.
**Task:** Fix the ingestion mapping (prefer RAWG `developers` primary over porting studios; fall back to publisher if ambiguous). Correct Minecraft. Run a spot-check script over the top 100 games by traffic comparing stored developer against RAWG canonical and output a diff for review.
**Acceptance:** Minecraft shows Mojang Studios; mapping fix committed; top-100 diff report generated.

---

## P2 — Consistency and polish

### 9. Two different navigations
**Problem:** Homepage nav is Browse / By Age / Platforms / Learn; methodology and game pages show Browse / Discover / Learn / Library. Templates are out of sync.
**Task:** Pick the canonical nav (recommend the homepage's parent-facing one, with Library appearing when signed in), extract it into a single shared component, and remove the divergent copy.
**Acceptance:** identical nav component on all routes; signed-out vs signed-in states intentional, not accidental.

### 10. Brand sprawl: LumiKin / LumiScore / PlaySmart Framework
**Problem:** Three names do one job. The methodology header says "PlaySmart Framework", the product says LumiScore, the site is LumiKin.
**Task:** Establish hierarchy in copy: **LumiKin** = the site/brand, **LumiScore** = the number a parent sees, and retire "PlaySmart" from user-facing surfaces (keep as internal codename only if removal is too invasive). Grep and update.
**Acceptance:** "PlaySmart" absent from rendered pages; LumiKin/LumiScore used consistently per the hierarchy.

### 11. Free-to-play vs price contradictions
**Problem:** Minecraft page shows "Base: $29.99" while pricing labels elsewhere say free-to-play for the wrong titles; pricing fields appear inconsistently sourced.
**Task:** Audit the pricing field pipeline; ensure monthly-cost "Heads up" labels and base-price labels come from the same source of truth; hide the label entirely when data is missing rather than defaulting to "Free to play".
**Acceptance:** no game shows contradictory price signals; missing data renders nothing.

### 12. Regression guard
**Task:** Add a CI check that fails the build if rendered output contains: bracketed editorial placeholders (`[Rationale`, `To be added`), duplicated score-label strings, or a methodology version string that differs from the canonical constant.
**Acceptance:** CI test exists and passes; deliberately reintroducing a placeholder fails the build.

---

## Working notes
- Don't fabricate: no invented citations, team bios, or compliance determinations. Where owner input is required, scaffold and flag.
- Preserve all five locales (EN/ES/FR/SV/DE) — every copy change needs translation slots, even if initially machine-drafted and marked for review.
- Commit per item with the item number in the message (e.g. `P0-1: replace methodology placeholders`).
- After P0 is done, redeploy and re-verify items 1–4 against the live site before starting P1.
