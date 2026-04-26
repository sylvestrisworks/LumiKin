# Analytics — LumiKin Plausible Setup

## Provider

Plausible Cloud — site `lumikin.org`. Custom hashed script URL.

Script injected site-wide in `src/app/layout.tsx` via `next/script` (`afterInteractive`):
- Inline init: establishes `window.plausible` queue before the external script loads
- External: `https://plausible.io/js/pa--Dusr9peIPVfgU_4d8QUi.js`

DNT (`navigator.doNotTrack === '1'`) is respected in `src/lib/plausible.ts` — no event is sent for users who opt out.

## Custom Goals

| Goal | Where fired | Implementation | Measurement intent |
|---|---|---|---|
| `partners_page_view` | `/[locale]/partners` on mount | `<PlausibleGoal>` in `page.tsx` | B2B funnel entry — how many potential API partners land on the page |
| `partners_form_submit` | Partners contact form on successful API response | `trackGoal()` in `ContactForm.tsx` after `res.ok` | Qualified leads submitted |
| `methodology_deep_read` | `/[locale]/methodology` after 50% scroll | `<PlausibleScrollDepth threshold={50}>` in `page.tsx` | Engagement signal for methodology credibility |
| `press_kit_view` | `/[locale]/press` on mount | `<PlausibleGoal>` in `page.tsx` | Press / media interest |
| `game_page_from_search` | `/[locale]/game/[slug]` on mount when `document.referrer` matches a search engine | `<PlausibleSearchReferrer>` in `page.tsx` | Organic search attribution per game page; fires with `{ referrer: hostname }` prop |
| `api_sample_copy` | Partners page API preview block, copy button click | `trackGoal()` in `ApiSampleBlock.tsx` | Intent signal for API trial |

## Components

| Component | Path | Behaviour |
|---|---|---|
| `PlausibleGoal` | `src/components/PlausibleGoal.tsx` | Fires one goal on mount |
| `PlausibleScrollDepth` | `src/components/PlausibleScrollDepth.tsx` | Fires when scroll crosses `threshold`% of page height; fires at most once per page load |
| `PlausibleSearchReferrer` | `src/components/PlausibleSearchReferrer.tsx` | Checks `document.referrer` on mount; fires `game_page_from_search` if referrer hostname matches known search engines |
| `ApiSampleBlock` | `src/app/[locale]/partners/_components/ApiSampleBlock.tsx` | Renders the API request/response sample with a copy button |

## Verifying in Plausible

1. Open the Plausible dashboard for `lumikin.org`
2. Goals are visible under **Goals** in the left nav
3. To create the goals: Goals → Add goal → Custom event → enter the goal name exactly as listed above
4. Real-time events appear under **Realtime** within seconds of triggering

## Verifying locally

In browser devtools console on any page:
```js
window.plausible   // should be a function once scripts load
```

Trigger a specific goal manually:
```js
window.plausible('partners_page_view')
```

Check the Network tab for requests to `plausible.io/api/event`.
