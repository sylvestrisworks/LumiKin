/**
 * Shared Anthropic (Claude) client for LumiKin translation jobs.
 *
 * Mirrors the role `src/lib/vertex-ai.ts` plays for Gemini, but for Claude. We
 * route translations through Claude (not Gemini) because the 2026-05-23 quality
 * audit found Gemini hallucinates content and drops game titles — Swedish worst.
 *
 * Auth: ANTHROPIC_API_KEY in the environment (read by the SDK automatically).
 *
 * callClaude      — full Message (use when you need usage / cache stats)
 * callClaudeText  — plain text generation (the common case)
 *
 * Caching: pass a `system` prefix and it is sent with cache_control:ephemeral.
 * Keep that prefix BYTE-STABLE across calls (e.g. per-locale instructions) and
 * put the volatile per-item content in `userContent` — that's the prefix-match
 * the cache relies on. Below the model's minimum cacheable prefix (~2K tokens
 * Sonnet, ~4K Haiku) it silently won't cache; that's fine, just no discount.
 */

import Anthropic from '@anthropic-ai/sdk'

// ─── Config ───────────────────────────────────────────────────────────────────

// Bare model IDs — do NOT append date suffixes (they 404).
export const CLAUDE_SONNET = 'claude-sonnet-4-6'  // higher fidelity — used for Swedish
export const CLAUDE_HAIKU  = 'claude-haiku-4-5'   // fast/cheap — used for de/fr/es

/** Per-locale model policy. Swedish was the worst-quality locale in the audit, so it gets Sonnet. */
export function modelForLocale(locale: string): string {
  return locale === 'sv' ? CLAUDE_SONNET : CLAUDE_HAIKU
}

// SDK retries 429 / 5xx / 529 with exponential backoff. Bump from the default 2.
const client = new Anthropic({ maxRetries: 5 })

// ─── Calls ──────────────────────────────────────────────────────────────────

export type ClaudeOptions = {
  /** Static instruction prefix — sent as a cached system block. Keep it byte-stable across calls. */
  system?:    string
  model?:     string
  maxTokens?: number
}

export async function callClaude(
  userContent: string,
  opts: ClaudeOptions = {},
): Promise<Anthropic.Message> {
  const { system, model = CLAUDE_HAIKU, maxTokens = 8192 } = opts

  // No thinking, no `effort` — translation is not a reasoning task, and `effort`
  // 400s on Haiku 4.5. Omitting `thinking` keeps these models in fast mode.
  return client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system
      ? { system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] }
      : {}),
    messages: [{ role: 'user', content: userContent }],
  })
}

export async function callClaudeText(
  userContent: string,
  opts: ClaudeOptions = {},
): Promise<string> {
  const msg = await callClaude(userContent, opts)
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
  if (!text.trim()) throw new Error('Claude returned no text')
  return text
}
