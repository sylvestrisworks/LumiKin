import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { partnerInquiries } from '@/lib/db/schema'
import { rateLimit, getIp } from '@/lib/rate-limit'

const schema = z.object({
  name:    z.string().min(1).max(255),
  company: z.string().min(1).max(255),
  role:    z.string().min(1).max(255),
  email:   z.string().email().max(255),
  usecase: z.string().min(1).max(5000),
  website: z.string().max(0), // honeypot — must be empty
})

const NOTIFY_TO = process.env.PARTNER_NOTIFY_EMAIL ?? 'johan@sylvestris.works'

export async function POST(req: Request) {
  if (!rateLimit(`partner-inquiry:${getIp(req)}`, 3, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    // Return 200 for honeypot failures so bots get no signal
    if (parsed.error.issues.some(i => i.path[0] === 'website')) {
      return NextResponse.json({ data: { ok: true } })
    }
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { name, company, role, email, usecase } = parsed.data

  // DB insert is the source of truth — do this first
  let inquiryId: number
  try {
    const [row] = await db
      .insert(partnerInquiries)
      .values({ name, company, role, email, usecase })
      .returning({ id: partnerInquiries.id })
    inquiryId = row.id
  } catch (err) {
    console.error('[partner-inquiry] DB insert failed:', err)
    return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 })
  }

  // Email is best-effort — failure does not fail the request
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[partner-inquiry] RESEND_API_KEY not set — skipping email (inquiry #%d saved)', inquiryId)
    return NextResponse.json({ data: { ok: true } })
  }

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from:     'LumiKin Partners <partners@lumikin.org>',
      to:       NOTIFY_TO,
      replyTo:  email,
      subject:  `Partner inquiry — ${company} (${name})`,
      text: [
        `New partner inquiry received via lumikin.org/partners`,
        ``,
        `Name:    ${name}`,
        `Company: ${company}`,
        `Role:    ${role}`,
        `Email:   ${email}`,
        ``,
        `Use case:`,
        usecase,
        ``,
        `—`,
        `Inquiry #${inquiryId} · Reply to this email to respond directly.`,
      ].join('\n'),
    })

    await db
      .update(partnerInquiries)
      .set({ emailSent: true })
      .where(eq(partnerInquiries.id, inquiryId))
  } catch (err) {
    console.error('[partner-inquiry] Email send failed (inquiry #%d still saved):', inquiryId, err)
  }

  return NextResponse.json({ data: { ok: true } })
}
