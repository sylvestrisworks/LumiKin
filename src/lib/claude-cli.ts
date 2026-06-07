/**
 * Headless Claude Code CLI bridge.
 *
 * Routes a translation through the locally-installed `claude` binary in print
 * mode (`-p`), which runs on the logged-in Claude Code subscription (Max) rather
 * than metered Anthropic API billing. Use this when you want to spend plan quota
 * instead of API credits — see scripts/drain-translations.ts --backend cli.
 *
 * Trade-offs vs the SDK path (src/lib/anthropic.ts): subject to subscription
 * usage limits, slower (each call boots a fresh agent), no prompt caching, no
 * token/usage accounting. Built for a slow, scoped trickle — not a fast drain.
 *
 * We replace the default system prompt entirely (`--system-prompt`) so the
 * sub-agent is a lean translator with none of the Claude Code project context,
 * and read the volatile per-item content from stdin to avoid command-line length
 * and quoting limits. Output is the `--output-format json` envelope.
 */

import { spawn } from 'child_process'

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude'

export type CliResult =
  | { ok: true;  text: string }
  | { ok: false; error: string; rateLimited: boolean; quotaExhausted: boolean }

// Hard cap — the plan's compute quota is spent. Backing off won't help (it resets
// on a long window), so callers should stop the whole run, not retry per-item.
const HARD_QUOTA_RE = /upgrade your plan|compute time quota|exceeded.{0,20}quota/i
// Transient — short rolling-window limits or overload. Worth a backoff + retry.
const RATE_LIMIT_RE = /rate.?limit|usage limit|overloaded|\b429\b|\b529\b/i

const classify = (s: string) => {
  const quotaExhausted = HARD_QUOTA_RE.test(s)
  return { quotaExhausted, rateLimited: !quotaExhausted && RATE_LIMIT_RE.test(s) }
}

export function runClaudeCli(
  system:    string,
  user:      string,
  model:     string,
  timeoutMs = 120_000,
): Promise<CliResult> {
  return new Promise((res) => {
    const child = spawn(
      CLAUDE_BIN,
      ['-p', '--model', model, '--output-format', 'json', '--system-prompt', system],
      { windowsHide: true },
    )

    let out = '', err = ''
    let settled = false
    const done = (r: CliResult) => { if (!settled) { settled = true; clearTimeout(timer); res(r) } }

    const timer = setTimeout(() => { child.kill(); done({ ok: false, error: 'timeout', rateLimited: false, quotaExhausted: false }) }, timeoutMs)

    child.stdout.on('data', d => { out += d })
    child.stderr.on('data', d => { err += d })
    child.on('error', e => done({ ok: false, error: String(e), rateLimited: false, quotaExhausted: false }))
    child.on('close', code => {
      try {
        const env = JSON.parse(out)
        if (env.type === 'result' && env.subtype === 'success' && typeof env.result === 'string') {
          // Over-quota / limit notices can come back as a "successful" result body
          // (exit 0, subtype success) rather than an error — catch that here so
          // callers abort instead of treating the notice as a translation.
          if (HARD_QUOTA_RE.test(env.result)) {
            return done({ ok: false, error: env.result.slice(0, 300), rateLimited: false, quotaExhausted: true })
          }
          return done({ ok: true, text: env.result })
        }
        const msg = String(env.result ?? env.error ?? err ?? `exit ${code}`)
        return done({ ok: false, error: msg.slice(0, 300), ...classify(msg + err) })
      } catch {
        const blob = (out + err).trim()
        return done({ ok: false, error: blob.slice(0, 300) || `exit ${code}`, ...classify(blob) })
      }
    })

    child.stdin.write(user)
    child.stdin.end()
  })
}
