import { describe, expect, it } from 'vitest'
import { chooseOrder, cyclePairs } from '../src/pairing.ts'
import { pairKey } from '../src/state.ts'
import { lobbyOf } from './harness.ts'

describe('pairing', () => {
  // The brief's structural claim: n players, n matchups, everyone writes twice.
  // If this breaks, the whole round shape breaks with it.
  for (const n of [3, 4, 5, 6, 7, 8]) {
    it(`gives ${n} players exactly ${n} matchups and two prompts each`, () => {
      const g = lobbyOf(n)
      g.dispatch({ type: 'game.start', seatId: g.host })

      expect(g.state.matchups).toHaveLength(n)

      const appearances = new Map<string, number>()
      for (const m of g.state.matchups) {
        expect(m.a.seatId).not.toBe(m.b.seatId)
        for (const id of [m.a.seatId, m.b.seatId]) {
          appearances.set(id, (appearances.get(id) ?? 0) + 1)
        }
      }

      expect(appearances.size).toBe(n)
      for (const [, count] of appearances) expect(count).toBe(2)

      for (const list of Object.values(g.state.assignments)) {
        expect(list).toHaveLength(2)
      }
    })
  }

  it('gives every player a distinct prompt pair', () => {
    const g = lobbyOf(6)
    g.dispatch({ type: 'game.start', seatId: g.host })
    const ids = g.state.matchups.map((m) => m.promptId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('avoids repeating a pairing when it has the freedom to', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const rng = { seed: 7 }
    const first = cyclePairs(chooseOrder(rng, ids, []))
    const past = first.map(([x, y]) => pairKey(x, y))
    const second = cyclePairs(chooseOrder(rng, ids, past))
    const repeats = second.filter(([x, y]) => past.includes(pairKey(x, y)))
    expect(repeats).toHaveLength(0)
  })

  it('cannot avoid repeats at three players, and says so by not crashing', () => {
    // Three players have exactly three possible pairs and each round uses all
    // three, so this is arithmetic, not a bug. Documented in ARCHITECTURE.md.
    const ids = ['a', 'b', 'c']
    const rng = { seed: 3 }
    const past = cyclePairs(chooseOrder(rng, ids, [])).map(([x, y]) => pairKey(x, y))
    const second = cyclePairs(chooseOrder(rng, ids, past))
    expect(second.filter(([x, y]) => past.includes(pairKey(x, y)))).toHaveLength(3)
  })
})
