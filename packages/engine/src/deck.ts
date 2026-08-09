import type { ContentLevel, Region } from '@ud/protocol'
import { shuffled } from './rng.ts'
import type { RoomState } from './state.ts'

export type LibraryPrompt = { id: string; region: Region; level: ContentLevel; text: string }

/**
 * The region's own prompts plus everything global, at or below the chosen
 * level. The mix is the point: region should read as a flavour, not a filter.
 */
export function eligible(
  library: readonly LibraryPrompt[],
  region: Region,
  level: ContentLevel,
): LibraryPrompt[] {
  return library.filter((p) => (p.region === region || p.region === 'global') && p.level <= level)
}

/**
 * Draw `count` unused prompts for a round.
 *
 * If the library is too thin to fill the round, the used list resets and
 * prompts come round again rather than the round arriving short. A repeat is a
 * mild disappointment; a matchup with no prompt is a broken game.
 */
export function drawPrompts(
  state: RoomState,
  library: readonly LibraryPrompt[],
  count: number,
): LibraryPrompt[] {
  const pool = eligible(library, state.settings.region, state.settings.level)
  if (pool.length === 0) {
    throw new Error(
      `no prompts for region "${state.settings.region}" at level ${state.settings.level}`,
    )
  }

  let unused = pool.filter((p) => !state.usedPromptIds.includes(p.id))
  if (unused.length < count) {
    state.usedPromptIds = []
    unused = pool
  }

  const drawn: LibraryPrompt[] = []
  for (const p of shuffled(state, unused)) {
    if (drawn.length >= count) break
    drawn.push(p)
    state.usedPromptIds.push(p.id)
  }

  // Only possible when the whole pool is smaller than one round.
  while (drawn.length < count) drawn.push(pool[drawn.length % pool.length]!)

  return drawn
}
