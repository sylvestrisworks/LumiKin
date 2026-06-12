import { describe, expect, test } from 'vitest'
import { pickPrimaryDeveloper } from '../mapper'

const devs = (...names: string[]) => names.map((name) => ({ name }))

describe('pickPrimaryDeveloper', () => {
  test('Minecraft: skips the porting house (4J Studios) for the original studio', () => {
    // RAWG lists 4J Studios first; Mojang is the primary developer.
    expect(
      pickPrimaryDeveloper(devs('4J Studios', 'Mojang Studios'), devs('Xbox Game Studios')),
    ).toBe('Mojang Studios')
  })

  test('falls back to publisher when every developer is a porting house', () => {
    expect(
      pickPrimaryDeveloper(devs('4J Studios', 'Iron Galaxy'), devs('Mojang Studios')),
    ).toBe('Mojang Studios')
  })

  test('single developer is returned as-is, porting house or not', () => {
    expect(pickPrimaryDeveloper(devs('4J Studios'), devs('Mojang'))).toBe('4J Studios')
    expect(pickPrimaryDeveloper(devs('CD Projekt Red'), devs('CD Projekt'))).toBe('CD Projekt Red')
  })

  test('no developers → publisher', () => {
    expect(pickPrimaryDeveloper([], devs('Nintendo'))).toBe('Nintendo')
    expect(pickPrimaryDeveloper(null, devs('Nintendo'))).toBe('Nintendo')
  })

  test('no developers and no publisher → null', () => {
    expect(pickPrimaryDeveloper([], [])).toBeNull()
    expect(pickPrimaryDeveloper(undefined, undefined)).toBeNull()
  })

  test('first real developer wins over a later one', () => {
    expect(
      pickPrimaryDeveloper(devs('Rockstar North', 'Rockstar Games'), devs('Rockstar Games')),
    ).toBe('Rockstar North')
  })

  test('porting house matching is case- and whitespace-insensitive', () => {
    expect(
      pickPrimaryDeveloper(devs('  ASPYR MEDIA ', 'Naughty Dog'), devs('Sony')),
    ).toBe('Naughty Dog')
  })
})
