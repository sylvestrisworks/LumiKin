import { describe, expect, test } from 'vitest'
import { normalizeTitle, matchTitle, type CatalogGame } from '../match'

const g = (id: number, title: string): CatalogGame => ({ id, slug: String(id), title, curascore: null })

function mapOf(...games: CatalogGame[]): Map<string, CatalogGame> {
  const m = new Map<string, CatalogGame>()
  for (const game of games) m.set(normalizeTitle(game.title), game)
  return m
}

describe('normalizeTitle', () => {
  test('lowercases and collapses whitespace', () => {
    expect(normalizeTitle('  The   Witcher 3  ')).toBe('the witcher 3')
  })

  test('strips trademark marks and punctuation', () => {
    expect(normalizeTitle('Half-Life™: Alyx®')).toBe('halflife alyx')
  })

  test('keeps alphanumerics only', () => {
    expect(normalizeTitle('S.T.A.L.K.E.R. 2')).toBe('stalker 2')
  })
})

describe('matchTitle', () => {
  const catalog = mapOf(
    g(1, 'Hades'),
    g(2, 'The Witcher 3: Wild Hunt'),
    g(3, 'Portal 2'),
  )

  test('exact normalised hit', () => {
    expect(matchTitle('hades', catalog)?.id).toBe(1)
    expect(matchTitle('Portal 2', catalog)?.id).toBe(3)
  })

  test('matches despite trademark/punctuation differences', () => {
    expect(matchTitle('Hades™', catalog)?.id).toBe(1)
    expect(matchTitle('The Witcher 3: Wild Hunt®', catalog)?.id).toBe(2)
  })

  test('strips edition markers as a fallback', () => {
    const c = mapOf(g(10, 'Skyrim'))
    expect(matchTitle('Skyrim Special Edition', c)).toBeNull() // 'special' not a marker
    expect(matchTitle('Skyrim Definitive', c)?.id).toBe(10)
    expect(matchTitle('Skyrim Remastered', c)?.id).toBe(10)
    expect(matchTitle('Skyrim GOTY', c)?.id).toBe(10)
  })

  test('strips trailing platform qualifiers', () => {
    const c = mapOf(g(20, 'Minecraft'), g(21, 'Hades'))
    expect(matchTitle('Minecraft for Nintendo Switch', c)?.id).toBe(20)
    expect(matchTitle('Minecraft - Windows 10', c)?.id).toBe(20)
    expect(matchTitle('Hades - PC', c)?.id).toBe(21)
    expect(matchTitle('Hades - Xbox Series X', c)?.id).toBe(21)
    expect(matchTitle('Hades for PlayStation 5', c)?.id).toBe(21)
  })

  test('does not strip platform words that are part of the real title', () => {
    const c = mapOf(g(30, 'PC Building Simulator'), g(31, 'Nintendo Switch Sports'))
    // platform words only stripped from the END, so leading/embedded ones survive
    expect(matchTitle('PC Building Simulator', c)?.id).toBe(30)
    expect(matchTitle('Nintendo Switch Sports', c)?.id).toBe(31)
  })

  test('combines edition + platform stripping', () => {
    const c = mapOf(g(40, 'Skyrim'))
    expect(matchTitle('Skyrim Anniversary - Windows', c)?.id).toBe(40)
  })

  test('returns null when no match', () => {
    expect(matchTitle('Some Unlisted Game', catalog)).toBeNull()
  })
})
