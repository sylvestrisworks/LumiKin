/**
 * Xbox (Microsoft) library client.
 *
 * Xbox has no simple ownership API, so we authenticate the parent's Microsoft
 * account and read their *title history* (games played/owned). The auth chain
 * is Microsoft's three-step dance:
 *
 *   MSA OAuth code → MSA access/refresh token   (login.live.com)
 *   MSA access token → XBL token + user hash    (user.auth.xboxlive.com)
 *   XBL token → XSTS token + XUID               (xsts.auth.xboxlive.com)
 *   XSTS → "XBL3.0 x=<uhs>;<token>" auth header → titlehub.xboxlive.com
 *
 * Only the long-lived MSA refresh token is persisted; the short-lived
 * XBL/XSTS tokens are re-derived from it on each sync.
 *
 * Requires an Azure AD app (XBOX_CLIENT_ID / XBOX_CLIENT_SECRET) with the
 * `XboxLive.signin offline_access` scope and a registered redirect URI.
 */

// ─── Constants ──────────────────────────────────────────────────────────────

export const CLIENT_ID     = process.env.XBOX_CLIENT_ID     ?? ''
export const CLIENT_SECRET = process.env.XBOX_CLIENT_SECRET ?? ''
export const SCOPE         = 'XboxLive.signin offline_access'

const MSA_AUTHORIZE = 'https://login.live.com/oauth20_authorize.srf'
const MSA_TOKEN     = 'https://login.live.com/oauth20_token.srf'
const XBL_AUTH      = 'https://user.auth.xboxlive.com/user/authenticate'
const XSTS_AUTH     = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const TITLEHUB      = 'https://titlehub.xboxlive.com'
const PROFILE       = 'https://profile.xboxlive.com'

// ─── MSA OAuth ────────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    response_type: 'code',
    redirect_uri:  redirectUri,
    scope:         SCOPE,
    state,
    // Always show the account chooser — without this, Microsoft silently reuses
    // the browser's existing session, so users can't pick which Xbox account to link.
    prompt:        'select_account',
  })
  return `${MSA_AUTHORIZE}?${params}`
}

export type MsaTokens = {
  accessToken:  string
  refreshToken: string
  expiresAt:    Date
}

type MsaTokenResponse = {
  access_token:  string
  refresh_token: string
  expires_in:    number
}

async function msaTokenRequest(body: Record<string, string>): Promise<MsaTokens> {
  const res = await fetch(MSA_TOKEN, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(body),
    signal:  AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Microsoft token request failed: ${res.status} ${text}`)
  }
  const data = await res.json() as MsaTokenResponse
  if (!data.access_token) throw new Error('No access_token in Microsoft response')
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    new Date(Date.now() + data.expires_in * 1000),
  }
}

export function exchangeCode(code: string, redirectUri: string): Promise<MsaTokens> {
  return msaTokenRequest({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
  })
}

export function refreshAccessToken(refreshToken: string, redirectUri: string): Promise<MsaTokens> {
  return msaTokenRequest({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    redirect_uri:  redirectUri,
    scope:         SCOPE,
  })
}

// ─── XBL → XSTS dance ─────────────────────────────────────────────────────────

type XblResponse = {
  Token:         string
  DisplayClaims: { xui: Array<{ uhs: string; xid?: string }> }
}

async function xblAuthenticate(msaAccessToken: string): Promise<{ token: string }> {
  const res = await fetch(XBL_AUTH, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-xbl-contract-version': '1', Accept: 'application/json' },
    body: JSON.stringify({
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType:    'JWT',
      Properties: {
        AuthMethod: 'RPS',
        SiteName:   'user.auth.xboxlive.com',
        // MSA tickets are prefixed with "d="; non-MSA (Azure AD) would use "t=".
        RpsTicket:  `d=${msaAccessToken}`,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`XBL authenticate failed: ${res.status} ${body}`)
  }
  const data = await res.json() as XblResponse
  return { token: data.Token }
}

export type XstsAuth = { authHeader: string; xuid: string; uhs: string }

async function xstsAuthorize(xblToken: string): Promise<XstsAuth> {
  const res = await fetch(XSTS_AUTH, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-xbl-contract-version': '1', Accept: 'application/json' },
    body: JSON.stringify({
      RelyingParty: 'http://xboxlive.com',
      TokenType:    'JWT',
      Properties:   { UserTokens: [xblToken], SandboxId: 'RETAIL' },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    // XSTS error bodies carry an XErr code that pinpoints the cause
    // (e.g. 2148916233 no Xbox account, 2148916238 child account, 2148916235 region).
    const body = await res.text().catch(() => '')
    throw new Error(`XSTS authorize failed: ${res.status} ${body}`)
  }
  const data = await res.json() as XblResponse
  const claim = data.DisplayClaims.xui[0]
  if (!claim?.uhs || !claim?.xid) throw new Error('XSTS response missing uhs/xuid')
  return {
    authHeader: `XBL3.0 x=${claim.uhs};${data.Token}`,
    xuid:       claim.xid,
    uhs:        claim.uhs,
  }
}

/** Run the full XBL→XSTS chain from a fresh MSA access token. */
export async function authorize(msaAccessToken: string): Promise<XstsAuth> {
  const { token } = await xblAuthenticate(msaAccessToken)
  return xstsAuthorize(token)
}

// ─── Profile + title history ────────────────────────────────────────────────

/** Best-effort gamertag for display. */
export async function fetchGamertag(xuid: string, authHeader: string): Promise<string | null> {
  try {
    const res = await fetch(`${PROFILE}/users/xuid(${xuid})/profile/settings?settings=Gamertag`, {
      headers: { Authorization: authHeader, 'x-xbl-contract-version': '2', Accept: 'application/json' },
      signal:  AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const data = await res.json() as {
      profileUsers?: Array<{ settings?: Array<{ id: string; value: string }> }>
    }
    const settings = data.profileUsers?.[0]?.settings ?? []
    return settings.find(s => s.id === 'Gamertag')?.value ?? null
  } catch {
    return null
  }
}

export type XboxTitle = { titleId: string; name: string }

/** Fetch the account's title history (games played/owned), with names. */
export async function fetchTitleHistory(xuid: string, authHeader: string): Promise<XboxTitle[]> {
  const res = await fetch(
    `${TITLEHUB}/users/xuid(${xuid})/titles/titlehistory/decoration/detail`,
    {
      headers: {
        Authorization:            authHeader,
        'x-xbl-contract-version': '2',
        'Accept-Language':        'en-US',
        Accept:                   'application/json',
      },
      signal: AbortSignal.timeout(20_000),
    },
  )
  if (!res.ok) throw new Error(`titlehub request failed: ${res.status}`)
  const data = await res.json() as {
    titles?: Array<{ titleId: string; name?: string; type?: string }>
  }
  const out: XboxTitle[] = []
  for (const t of data.titles ?? []) {
    if (t.name) out.push({ titleId: t.titleId, name: t.name })
  }
  return out
}
