/**
 * GOG (Galaxy) library client.
 *
 * GOG has no public third-party OAuth program, so — like our Nintendo
 * integration — we use the official GOG Galaxy client credentials with the
 * embed redirect and a *paste-the-redirect-URL* flow:
 *
 *   1. User opens buildAuthUrl() and signs in at auth.gog.com.
 *   2. GOG redirects to embed.gog.com/on_login_success?...&code=XXX and shows
 *      a blank page — the user copies that URL back to us.
 *   3. parseCode() extracts the code; exchangeCode() swaps it for tokens.
 *
 * The Galaxy client_id/secret are well-known public values; they can be
 * overridden via GOG_CLIENT_ID / GOG_CLIENT_SECRET if GOG ever issues us a
 * dedicated app.
 */

// ─── Constants ──────────────────────────────────────────────────────────────

// Public GOG Galaxy client credentials (overridable via env).
export const CLIENT_ID     = process.env.GOG_CLIENT_ID     ?? '46899977096215655'
export const CLIENT_SECRET = process.env.GOG_CLIENT_SECRET ?? '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9'
export const REDIRECT_URI  = 'https://embed.gog.com/on_login_success?origin=client'

const AUTH_URL     = 'https://auth.gog.com/auth'
const TOKEN_URL    = 'https://auth.gog.com/token'
const USERDATA_URL = 'https://embed.gog.com/userData.json'
const PRODUCTS_URL = 'https://embed.gog.com/account/getFilteredProducts'

// ─── Auth URL ─────────────────────────────────────────────────────────────────

export function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    layout:        'client2',
  })
  return `${AUTH_URL}?${params}`
}

/** Pull the `code` query param out of the pasted on_login_success URL. */
export function parseCode(pastedUrl: string): string {
  const match = pastedUrl.match(/[?&#]code=([^&\s]+)/)
  if (!match) {
    throw new Error('Could not find a login code in that URL. Please copy the full address bar after signing in.')
  }
  return decodeURIComponent(match[1])
}

// ─── Token exchange ─────────────────────────────────────────────────────────

export type GogTokens = {
  accessToken:  string
  refreshToken: string
  expiresAt:    Date
  gogUserId:    string
}

type GogTokenResponse = {
  access_token:  string
  refresh_token: string
  expires_in:    number
  user_id:       string
}

async function tokenRequest(body: Record<string, string>): Promise<GogTokens> {
  const res = await fetch(`${TOKEN_URL}?${new URLSearchParams(body)}`, {
    method:  'GET',
    headers: { Accept: 'application/json' },
    signal:  AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GOG token request failed: ${res.status} ${text}`)
  }
  const data = await res.json() as GogTokenResponse
  if (!data.access_token) throw new Error('No access_token in GOG response')
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    new Date(Date.now() + data.expires_in * 1000),
    gogUserId:    data.user_id,
  }
}

export function exchangeCode(code: string): Promise<GogTokens> {
  return tokenRequest({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  REDIRECT_URI,
  })
}

export function refreshAccessToken(refreshToken: string): Promise<GogTokens> {
  return tokenRequest({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
  })
}

// ─── Library / profile calls ──────────────────────────────────────────────────

/** Fetch the user's GOG display name (best-effort). */
export async function fetchUsername(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USERDATA_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal:  AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const data = await res.json() as { username?: string }
    return data.username ?? null
  } catch {
    return null
  }
}

export type GogProduct = { productId: string; title: string }

/**
 * Fetch every product the user owns, with titles. getFilteredProducts returns
 * the account's owned games (mediaType=1) paginated; we walk all pages.
 */
export async function fetchOwnedProducts(accessToken: string): Promise<GogProduct[]> {
  const products: GogProduct[] = []
  let page = 1
  let totalPages = 1

  do {
    const params = new URLSearchParams({ mediaType: '1', page: String(page) })
    const res = await fetch(`${PRODUCTS_URL}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal:  AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      // Stop on error rather than throwing — return whatever we gathered.
      break
    }
    const data = await res.json() as {
      totalPages?: number
      products?:   Array<{ id: number | string; title?: string }>
    }
    totalPages = data.totalPages ?? 1
    for (const p of data.products ?? []) {
      if (p.title) products.push({ productId: String(p.id), title: p.title })
    }
    page++
  } while (page <= totalPages && page <= 50) // hard cap: 50 pages

  return products
}
