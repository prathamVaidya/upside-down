import type { CSSProperties } from 'react'
import { useMemo } from 'react'

/**
 * Handmade irregularity, derived rather than rolled.
 *
 * The look depends on nothing being symmetric — uneven corner radii, a degree
 * or two of rotation, no two elements alike. The trap is computing that during
 * render: React re-renders constantly during a countdown, and a `Math.random()`
 * in the render path would reshape every object on screen several times a
 * second. The whole stage would shimmer.
 *
 * So the shape is a pure function of a stable seed. The same seat, tile or card
 * is the same lump of clay for the life of the game.
 */
function hash(seed: string | number): number {
  const s = String(seed)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type ClayShapeOptions = {
  /** Base corner radius in px. */
  radius?: number
  /** How far corners may wander from the base, in px. */
  jitter?: number
  /** Maximum tilt in degrees, applied either way. */
  tilt?: number
}

export function clayShape(
  seed: string | number,
  { radius = 22, jitter = 6, tilt = 1.6 }: ClayShapeOptions = {},
): CSSProperties {
  const h = hash(seed)
  const at = (shift: number) => ((h >>> shift) & 0xff) / 255

  const corner = (shift: number) => `${Math.round(radius + (at(shift) - 0.5) * 2 * jitter)}px`

  return {
    '--r1': corner(0),
    '--r2': corner(6),
    '--r3': corner(12),
    '--r4': corner(18),
    '--rot': `${((at(24) - 0.5) * 2 * tilt).toFixed(2)}deg`,
  } as CSSProperties
}

export function useClayShape(seed: string | number, options?: ClayShapeOptions): CSSProperties {
  const { radius, jitter, tilt } = options ?? {}
  // biome-ignore lint/correctness/useExhaustiveDependencies: destructured on purpose so an inline options object does not thrash the memo
  return useMemo(() => clayShape(seed, { radius, jitter, tilt }), [seed, radius, jitter, tilt])
}
