/**
 * Token encryption at rest for OAuth credentials (Epic access/refresh tokens,
 * Nintendo session tokens) stored in the database.
 *
 * Format: `v1:<iv-base64>:<authtag-base64>:<ciphertext-base64>`
 *   - AES-256-GCM with a random 12-byte IV per encryption
 *   - 16-byte auth tag protects integrity + confidentiality
 *   - Versioned prefix lets us migrate algorithms without a DB migration
 *
 * Migration is lazy: any row written before this helper existed is plaintext
 * (no `v1:` prefix). `decryptToken` returns those untouched, and the next
 * refresh will encrypt them. Eventually all rows are encrypted.
 *
 * Key: 32 raw bytes from `TOKEN_ENCRYPTION_KEY` env, hex- or base64-encoded.
 * Throws on missing/wrong-size key — we never want to silently fall back to
 * weak storage.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const VERSION   = 'v1'
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES  = 12
const KEY_BYTES = 32

let _keyCache: Buffer | null = null

function getKey(): Buffer {
  if (_keyCache) return _keyCache

  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not set — generate one with: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    )
  }

  // Accept either hex (64 chars) or base64 (44 chars with padding).
  let buf: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    buf = Buffer.from(raw, 'hex')
  } else {
    buf = Buffer.from(raw, 'base64')
  }

  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${buf.length}`,
    )
  }

  _keyCache = buf
  return buf
}

/** Encrypt a plaintext token. Returns a `v1:...` string safe to store in TEXT. */
export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv  = randomBytes(IV_BYTES)
  const cipher  = createCipheriv(ALGORITHM, key, iv)
  const enc     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${VERSION}:${iv.toString('base64')}:${authTag.toString('base64')}:${enc.toString('base64')}`
}

/**
 * Decrypt a stored token. If the value has no `v1:` prefix, it is assumed to
 * be a legacy plaintext token (written before encryption was introduced) and
 * returned as-is. Throws on malformed v1 payloads or auth-tag mismatch.
 */
export function decryptToken(stored: string): string {
  if (!stored.startsWith(`${VERSION}:`)) return stored // legacy plaintext

  const parts = stored.split(':')
  if (parts.length !== 4) throw new Error('Malformed encrypted token')

  const [, ivB64, tagB64, ctB64] = parts
  const iv      = Buffer.from(ivB64,  'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const ct      = Buffer.from(ctB64,  'base64')

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

/** True if a stored value is in the encrypted (`v1:`) format. */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(`${VERSION}:`)
}
