/**
 * The one place the engine touches the filesystem — and it is deliberately not
 * part of `@ud/engine`'s main entry, so importing the reducer never reads a
 * file. Servers and test harnesses come through here; the reducer itself stays
 * data-in, data-out.
 */
import { content } from '@ud/content'
import type { Ctx } from './ctx.ts'
import type { LibraryPrompt } from './deck.ts'

export function loadLibrary(): { library: LibraryPrompt[]; fallbacks: string[] } {
  const { prompts, fallbacks } = content()
  return { library: prompts, fallbacks }
}

/** A `Ctx` for `now`, backed by the real content library. */
export function ctxAt(now: number): Ctx {
  const { library, fallbacks } = loadLibrary()
  return { now, library, fallbacks }
}

/** Room-code words, lowercase in the file and upper on the television. */
export function codeWords(): string[] {
  return content().words.map((w) => w.toUpperCase())
}
