import { describe, expect, test } from 'vitest'
import { planOwnedUpserts } from '../owned'

describe('planOwnedUpserts', () => {
  test('inserts games the user does not yet own', () => {
    const existing = new Map<number, string>()
    const { toInsertIds, toClaimIds } = planOwnedUpserts(existing, [1, 2, 3], 'steam')
    expect(toInsertIds).toEqual([1, 2, 3])
    expect(toClaimIds).toEqual([])
  })

  test('dedupes incoming ids', () => {
    const { toInsertIds } = planOwnedUpserts(new Map(), [1, 1, 2, 2, 2], 'gog')
    expect(toInsertIds).toEqual([1, 2])
  })

  test('a platform claims existing manual rows', () => {
    const existing = new Map<number, string>([[1, 'manual'], [2, 'manual']])
    const { toInsertIds, toClaimIds } = planOwnedUpserts(existing, [1, 2, 3], 'epic')
    expect(toInsertIds).toEqual([3])
    expect(toClaimIds).toEqual([1, 2])
  })

  test('one platform never clobbers another platform', () => {
    const existing = new Map<number, string>([[1, 'steam'], [2, 'gog']])
    const { toInsertIds, toClaimIds } = planOwnedUpserts(existing, [1, 2], 'epic')
    expect(toInsertIds).toEqual([])
    expect(toClaimIds).toEqual([])
  })

  test("manual imports never claim other rows", () => {
    const existing = new Map<number, string>([[1, 'manual']])
    const { toInsertIds, toClaimIds } = planOwnedUpserts(existing, [1, 2], 'manual')
    expect(toInsertIds).toEqual([2])
    expect(toClaimIds).toEqual([])
  })
})
