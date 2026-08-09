/**
 * Seeded randomness that lives *in* the room state rather than beside it.
 *
 * This is what makes a game replayable: feed the same seed and the same event
 * log back in and you get a byte-identical game, so a bug someone hits at a
 * party becomes a regression test. An ambient `Math.random()` would quietly
 * destroy that property, which is why the engine has none.
 */
export type RngState = { seed: number }

/** mulberry32 — small, fast, good enough to shuffle eight names. */
export function nextRandom(rng: RngState): number {
  rng.seed = (rng.seed + 0x6d2b79f5) | 0
  let t = rng.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function randomInt(rng: RngState, maxExclusive: number): number {
  return Math.floor(nextRandom(rng) * maxExclusive)
}

/** Fisher–Yates on a copy. */
export function shuffled<T>(rng: RngState, items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

export function pick<T>(rng: RngState, items: readonly T[]): T | undefined {
  return items.length === 0 ? undefined : items[randomInt(rng, items.length)]
}
