import type { LibraryPrompt } from './deck.ts'

/**
 * Everything the reducer needs from the outside world, handed in rather than
 * reached for. There is no clock, no filesystem and no randomness beyond what
 * is already recorded in `RoomState.seed`.
 */
export type Ctx = {
  /** Server time for this event, in epoch ms. */
  now: number
  library: readonly LibraryPrompt[]
  fallbacks: readonly string[]
}
