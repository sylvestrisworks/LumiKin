# Security & Bug Audit — Curascore

Audited: 2026-04-09. `.env` confirmed never committed (false alarm — gitignore has always blocked it).

---

## HIGH

### H1 — No rate limiting on public API routes
**Files:**
- `src/app/api/search/route.ts`
- `src/app/api/game/[slug]/route.ts`
- `src/app/api/suggest/route.ts`

No per-IP request limits. All three hit the DB on every call. Vercel project-level firewall exists but no app-level rate limiting.

**Fix:** Add rate limiting middleware (e.g. `@upstash/ratelimit` + Vercel KV, or Vercel Firewall rules). Suggested limits: 50 req/min for `/api/search`, 100 req/min for `/api/game`.

---

### H2 — No input length bounds before SQL template interpolation
**Files:**
- `src/app/[locale]/browse/page.tsx` — genre/platform/benefit arrays passed to `sql\`...\`` without per-element `.max()` or array length cap
- `src/app/api/suggest/route.ts` — `genre` param interpolated without `.max(50)`

Drizzle parameterizes values so no injection risk, but an arbitrarily long string generates an oversized query.

**Fix:** Add Zod validation: `z.string().max(50)` on individual params, `z.array(z.string().max(20)).max(10)` on array params.

---

## MEDIUM

### M1 — Open redirect URL-decoding bypass
**File:** `src/app/[locale]/login/page.tsx` ~line 12

Current check blocks `//attacker.com` but not the encoded form `%2F%2Fattacker.com`.

```ts
// Current
const callbackUrl = rawCallback.startsWith('/') && !rawCallback.startsWith('//') ? rawCallback : '/review'

// Fix
const decoded = decodeURIComponent(rawCallback)
const callbackUrl = decoded.startsWith('/') && !decoded.startsWith('//') ? decoded : '/review'
```

---

### M2 — `dangerouslySetInnerHTML` for JSON-LD script tag
**File:** `src/app/[locale]/game/[slug]/page.tsx`

Low actual XSS risk since `JSON.stringify` output is safe, but it's a linting/scanner flag.

```tsx
// Current
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

// Fix
<script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
```

---

## LOW

### L1 — Locale cookie not validated in middleware
**File:** `src/middleware.ts`

`NEXT_LOCALE` cookie value is used without checking it's in `routing.locales`. A garbage cookie value could cause a render error.

```ts
// Fix
const rawLocale = req.cookies.get('NEXT_LOCALE')?.value ?? routing.defaultLocale
const locale = routing.locales.includes(rawLocale as string) ? rawLocale : routing.defaultLocale
```

---

### L2 — Pagination doesn't cap to valid page range
**File:** `src/app/[locale]/browse/page.tsx`

`?page=9999999` returns empty results with no redirect to the last valid page.

**Fix:** After querying `total`, add: `if (currentPage > totalPages && totalPages > 0) redirect(pageUrl(filters, totalPages, locale))`

---

---

## LAUNCH READINESS

### LR1 — Compare page has no metadata ⛔ blocker
**File:** `src/app/[locale]/compare/page.tsx`

No `metadata` export at all. Shared links will have no title, description, or OG preview.

**Fix:** Add `export const metadata: Metadata = { title: 'Compare Games — Curascore', description: '...' }`

---

### LR2 — Home page has no page-level metadata ⛔ blocker
**File:** `src/app/[locale]/page.tsx`

Root layout has global OG config but no page-specific title or description override.

**Fix:** Add `metadata` export with page-specific title and description.

---

### LR3 — No sitemap.xml or robots.txt
Search engines have no crawl map. No ability to block internal/admin routes.

**Fix:** Add `src/app/sitemap.ts` (dynamic, pulls all game slugs from DB) and `src/app/robots.ts`.

---

### LR4 — Feedback not discoverable by users
The feedback API and reviewer inbox both work, but game pages have no visible "Report this score" link for end users.

**Fix:** Add a small "Report" or "Disagree with this score?" link on `game/[slug]` pointing to the feedback form.

---

### LR5 — No custom 404 / error pages
Next.js defaults show on 404/5xx — no brand, no navigation back.

**Fix:** Add `src/app/[locale]/not-found.tsx` and `src/app/[locale]/error.tsx`.

---

### LR6 — REVIEWER_EMAIL / REVIEWER_PASSWORD missing from .env.example
Anyone setting up the project won't know these are required for reviewer login.

**Fix:** Add both vars (with placeholder values) to `.env.example`.

---

### LR7 — No analytics
No Vercel Analytics, PostHog, Sentry, or equivalent. Can't track user behaviour or catch production errors after launch.

**Fix:** Install `@vercel/analytics` (one-liner) before deploying. Add error tracking post-launch.

---

### LR8 — No Privacy Policy or Terms of Service pages
No `/privacy` or `/terms` routes exist. Legal risk once real users land.

**Fix:** Add placeholder pages before or immediately after public launch.

---

## Verified OK

- Score formula (RIS/BDS/Curascore/time tiers) — matches `docs/RUBRIC.md` exactly ✓
- Null safety in scoring engine — all nulls default to `0` correctly ✓
- `useEffect` dependency arrays in SearchBar and compare page — correct ✓
- URL encoding in search (`encodeURIComponent`) — correct ✓
- Auth protection on `/api/review` routes — NextAuth JWT middleware in place ✓
- SQL injection — all queries use Drizzle parameterized queries ✓
