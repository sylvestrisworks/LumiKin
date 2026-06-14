import { describe, it, expect } from 'vitest'
import { normalizeBaseTitle, findInheritedBundledNote, type FlaggedGame } from '../bundled-online'

const flagged: FlaggedGame[] = [
  { id: 1, slug: 'grand-theft-auto-v', title: 'Grand Theft Auto V', bundledOnlineNote: 'GTA Online ships in the same launcher…' },
  { id: 4, slug: 'red-dead-redemption-2', title: 'Red Dead Redemption 2', bundledOnlineNote: 'Red Dead Online is bundled…' },
  { id: 501, slug: 'minecraft', title: 'Minecraft', bundledOnlineNote: 'Minecraft Realms…' },
]

describe('normalizeBaseTitle', () => {
  it('strips edition/remaster qualifiers down to the base game', () => {
    expect(normalizeBaseTitle('Grand Theft Auto V Enhanced')).toBe('grand theft auto v')
    expect(normalizeBaseTitle('Grand Theft Auto V')).toBe('grand theft auto v')
    expect(normalizeBaseTitle('The Witcher 3: Wild Hunt – Complete Edition')).toBe('the witcher 3 wild hunt')
    expect(normalizeBaseTitle('Red Dead Redemption 2: Ultimate Edition')).toBe('red dead redemption 2')
  })

  it('leaves a plain base title unchanged', () => {
    expect(normalizeBaseTitle('Red Dead Redemption 2')).toBe('red dead redemption 2')
  })
})

describe('findInheritedBundledNote', () => {
  it('inherits the note for an edition/remaster of a flagged title', () => {
    const r = findInheritedBundledNote({ id: 999, title: 'Grand Theft Auto V Enhanced' }, flagged)
    expect(r?.via).toBe('edition:grand-theft-auto-v')
    expect(r?.note).toMatch(/GTA Online/)
  })

  it('does not match an unrelated title', () => {
    expect(findInheritedBundledNote({ id: 999, title: 'Stardew Valley' }, flagged)).toBeNull()
  })

  it('does not match a different game in the same franchise (no franchise-wide inheritance)', () => {
    // Grand Theft Auto IV is a distinct game, not an edition of GTA V.
    expect(findInheritedBundledNote({ id: 999, title: 'Grand Theft Auto IV' }, flagged)).toBeNull()
  })

  it('does not match a spinoff that merely shares franchise words', () => {
    expect(findInheritedBundledNote({ id: 999, title: 'Minecraft Legends' }, flagged)).toBeNull()
    expect(findInheritedBundledNote({ id: 999, title: 'Minecraft Dungeons' }, flagged)).toBeNull()
  })

  it('does not match itself', () => {
    expect(findInheritedBundledNote({ id: 1, title: 'Grand Theft Auto V' }, flagged)).toBeNull()
  })
})
