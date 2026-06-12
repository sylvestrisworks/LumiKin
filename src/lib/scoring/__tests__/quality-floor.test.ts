// Quality-floor tests.
//
// Fixtures are drawn from the June 2026 external audit of the Roblox catalogue:
//   - "[Place 1] Lua Script Execution" scored 80 / 120 min (exploit tooling)
//   - junk templates: "Baseplate", "a true baseplate", "smosh"
//   - creator displayed as raw id "Guest_800000000000"
// The floor must keep these out of listings, and exploit tooling must be
// denylisted from scoring entirely.

import { describe, expect, test } from 'vitest'
import {
  isExploitTooling,
  passesListingQualityFloor,
  isListable,
  MIN_VISITS_FOR_LISTING,
} from '../quality-floor'

describe('isExploitTooling (scoring denylist)', () => {
  test.each([
    'Lua Script Execution',
    '[Place 1] Lua Script Execution',
    'Free Admin 🛠️',
    'Admin Commands House',
    'Script Hub V3',
    'Synapse X Executor',
    'Best Aimbot ESP',
  ])('flags exploit tooling: %s', (title) => {
    expect(isExploitTooling(title)).toBe(true)
  })

  test.each([
    'Tower of Hell',
    'Adopt Me',
    'Brookhaven 🏡 RP',
    'Natural Disaster Survival',
    'Blox Fruits',
  ])('does not flag legitimate experiences: %s', (title) => {
    expect(isExploitTooling(title)).toBe(false)
  })

  test('matches exploit signals in the description even when the title is innocuous', () => {
    expect(isExploitTooling('Cool Hangout', 'Get free admin and run any lua script here')).toBe(true)
  })
})

describe('passesListingQualityFloor', () => {
  const big = MIN_VISITS_FOR_LISTING * 1000

  test('exploit tooling is filtered with reason exploit_tooling', () => {
    const r = passesListingQualityFloor({ title: '[Place 1] Lua Script Execution', creatorName: 'someone', visitCount: big })
    expect(r).toEqual({ ok: false, reason: 'exploit_tooling' })
  })

  test.each(['Baseplate', 'a true baseplate', 'Place 1', '[Place 17] cool', 'My First Game', 'Test Place', 'Untitled', 'Untitled Game'])(
    'junk title is filtered even with high visits: %s',
    (title) => {
      const r = passesListingQualityFloor({ title, creatorName: 'RealCreator', visitCount: big })
      expect(r).toEqual({ ok: false, reason: 'junk_title' })
    },
  )

  test.each(['UNTITLED RPG GAME', 'Untitled Goose Game', '[滿開] UNTITLED RPG GAME [WEEKEND DROP 1.5X!]'])(
    'a real title that merely contains "untitled" is NOT filtered: %s',
    (title) => {
      expect(isListable({ title, creatorName: 'RealCreator', visitCount: big })).toBe(true)
    },
  )

  test.each(['Guest_800000000000', 'Guest', '12345678', 'user_42'])(
    'junk creator is filtered: %s',
    (creatorName) => {
      const r = passesListingQualityFloor({ title: 'A Normal Looking Game', creatorName, visitCount: big })
      expect(r).toEqual({ ok: false, reason: 'junk_creator' })
    },
  )

  test('below the visit floor is filtered', () => {
    const r = passesListingQualityFloor({ title: 'Tiny Indie Obby', creatorName: 'DevPerson', visitCount: 42 })
    expect(r).toEqual({ ok: false, reason: 'below_visit_floor' })
  })

  test('unknown visit count is not excluded on engagement alone', () => {
    expect(isListable({ title: 'Freshly Ingested Game', creatorName: 'DevPerson', visitCount: null })).toBe(true)
  })

  test('a legitimate, popular experience passes', () => {
    expect(isListable({ title: 'Adopt Me', creatorName: 'Uplift Games', visitCount: big })).toBe(true)
  })

  test('the named audit failure ("smosh" with trivial visits) is filtered', () => {
    expect(isListable({ title: 'smosh', creatorName: 'someuser', visitCount: 12 })).toBe(false)
  })
})
