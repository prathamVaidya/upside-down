import type { SeatId } from '@ud/protocol'
import type { RngState } from './rng.ts'
import { shuffled } from './rng.ts'
import { pairKey } from './state.ts'

/**
 * Each player writes two answers and each prompt receives exactly two, which
 * makes the matchup graph 2-regular — a cycle. Take an order and pair each
 * player with the next one round the ring: exactly `n` matchups, every player
 * in precisely two of them.
 */
export function cyclePairs(order: readonly SeatId[]): [SeatId, SeatId][] {
  return order.map((id, i) => [id, order[(i + 1) % order.length]!])
}

/**
 * Pick a seating order that repeats as few previous pairings as possible.
 *
 * Best-effort by design. At three players there are only three possible pairs
 * and every round consumes all three, so repeats are arithmetically unavoidable
 * — we minimise them rather than promising to eliminate them.
 */
export function chooseOrder(
  rng: RngState,
  ids: readonly SeatId[],
  pastPairs: readonly string[],
  attempts = 24,
): SeatId[] {
  const past = new Set(pastPairs)
  let best: SeatId[] | null = null
  let bestRepeats = Number.POSITIVE_INFINITY

  for (let i = 0; i < attempts; i++) {
    const order = shuffled(rng, ids)
    const repeats = cyclePairs(order).filter(([a, b]) => past.has(pairKey(a, b))).length
    if (repeats < bestRepeats) {
      best = order
      bestRepeats = repeats
      if (repeats === 0) break
    }
  }

  return best ?? ids.slice()
}
