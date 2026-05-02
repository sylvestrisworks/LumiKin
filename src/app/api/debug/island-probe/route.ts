/**
 * GET /api/debug/island-probe?code=CCCC-CCCC-CCCC
 *
 * Probes multiple Epic + third-party endpoints from a Vercel function to find
 * one that returns thumbnail metadata for a Fortnite Creative island. Used to
 * pick a working source after the fortnite.com OG scraper got Cloudflare-blocked.
 *
 * Auth: Bearer CRON_SECRET (so it isn't a public probe surface).
 */

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const TOKEN_URL  = 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token'
const FORTNITE_UA = 'Fortnite/++Fortnite+Release-33.00-CL-38383825 Windows/10.0.22631.1.0.0.256.64bit'
const FB_BOT_UA   = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'

async function getEpicToken(): Promise<string | null> {
  const id     = process.env.EPIC_CLIENT_ID?.trim()
  const secret = process.env.EPIC_CLIENT_SECRET?.trim()
  if (!id || !secret) return null
  const creds = Buffer.from(`${id}:${secret}`).toString('base64')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) return null
  const j = await res.json() as { access_token: string }
  return j.access_token
}

type ProbeResult = {
  name:    string
  url:     string
  status:  number | string
  bodyStart?: string
  ogImage?:   string | null
  jsonKeys?:  string[]
  bytes?:     number
}

async function probe(name: string, url: string, headers: Record<string, string>): Promise<ProbeResult> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) })
    const ct  = res.headers.get('content-type') ?? ''
    const out: ProbeResult = { name, url, status: res.status }

    if (ct.includes('json')) {
      try {
        const j = await res.json()
        out.jsonKeys = j && typeof j === 'object' ? Object.keys(j as object) : []
        out.bodyStart = JSON.stringify(j).slice(0, 400)
      } catch { /* ignore */ }
    } else {
      const t = await res.text()
      out.bytes = t.length
      const og = t.match(/property="og:image"\s+content="([^"]+)"/)?.[1]
              ?? t.match(/content="([^"]+)"\s+property="og:image"/)?.[1]
              ?? null
      out.ogImage = og
      if (!og) out.bodyStart = t.slice(0, 200).replace(/\s+/g, ' ')
    }
    return out
  } catch (e) {
    return { name, url, status: `ERR ${(e as Error).message}` }
  }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const code = req.nextUrl.searchParams.get('code') ?? '2778-3253-4171'
  const token = await getEpicToken()
  const epicHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, 'User-Agent': FORTNITE_UA }
    : {}

  const results: ProbeResult[] = []

  // 1. fortnite.com — does Cloudflare let Vercel through?
  results.push(await probe(
    'fortnite.com (FB UA)',
    `https://www.fortnite.com/creative/island/${encodeURIComponent(code)}`,
    { 'User-Agent': FB_BOT_UA, Accept: 'text/html' },
  ))
  results.push(await probe(
    'fortnite.com (Twitterbot)',
    `https://www.fortnite.com/creative/island/${encodeURIComponent(code)}`,
    { 'User-Agent': 'Twitterbot/1.0', Accept: 'text/html' },
  ))

  // 2. Epic links API direct mnemonic
  if (token) {
    results.push(await probe(
      'links.community-svc /mnemonic/{code}',
      `https://links.community-svc.ol.epicgames.com/links/api/fn/mnemonic/${encodeURIComponent(code)}`,
      epicHeaders,
    ))
    results.push(await probe(
      'links.community-svc ?category={code}',
      `https://links.community-svc.ol.epicgames.com/links/api/fn/mnemonic?category=${encodeURIComponent(code)}&start=0&count=1`,
      epicHeaders,
    ))

    // 3. discoveryservice
    results.push(await probe(
      'discoveryservice (panels)',
      `https://discoveryservice-public-service-prod.ol.epicgames.com/api/v1/discovery/panels`,
      epicHeaders,
    ))
    results.push(await probe(
      'discoveryservice islands by code',
      `https://discoveryservice-public-service-prod.ol.epicgames.com/api/v1/discovery/islands/${encodeURIComponent(code)}`,
      epicHeaders,
    ))

    // 4. habanero variants
    results.push(await probe(
      'habanero linked-island-metadata',
      `https://fn-service-habanero-live-public.ogs.live.on.epicgames.com/api/v1/creator-made-content/linked-island-metadata/${encodeURIComponent(code)}`,
      epicHeaders,
    ))
  } else {
    results.push({ name: 'epic-token', url: '-', status: 'no creds in env' })
  }

  // 5. fortnite.gg URL variants (Cloudflare lets Vercel through; just need right path)
  const fnggUrls = [
    `https://fortnite.gg/island?code=${encodeURIComponent(code)}`,
    `https://fortnite.gg/creative-island?island=${encodeURIComponent(code)}`,
    `https://fortnite.gg/creative/${encodeURIComponent(code)}`,
    `https://fortnite.gg/play/${encodeURIComponent(code)}`,
    `https://fortnite.gg/maps/${encodeURIComponent(code)}`,
    `https://fortnite.gg/c/${encodeURIComponent(code)}`,
    `https://fortnite.gg/api/island?code=${encodeURIComponent(code)}`,
    `https://fortnite.gg/api/v1/island/${encodeURIComponent(code)}`,
    `https://fortnite.gg/?island=${encodeURIComponent(code)}`,
  ]
  for (const url of fnggUrls) {
    results.push(await probe(
      `fortnite.gg ${url.split('//')[1].split('?')[0].split('fortnite.gg')[1] || '/'}`,
      url,
      { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    ))
  }

  return NextResponse.json({ code, hasEpicToken: !!token, results })
}
