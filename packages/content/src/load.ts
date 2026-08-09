import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ContentLevel, Region } from '@ud/protocol'
import { parse } from 'yaml'
import { FallbackFileSchema, PromptFileSchema, WordFileSchema } from './schema.ts'

export type Prompt = {
  id: string
  region: Region
  level: ContentLevel
  text: string
}

export type Content = {
  prompts: Prompt[]
  fallbacks: string[]
  words: string[]
}

/** Repo-root `content/` directory, resolved from this file rather than cwd. */
export const CONTENT_DIR = fileURLToPath(new URL('../../../content/', import.meta.url))

function readYaml(relativePath: string): unknown {
  return parse(readFileSync(join(CONTENT_DIR, relativePath), 'utf8'))
}

/**
 * Reads and validates everything under `content/`. Throws on malformed content
 * rather than silently dropping it — a prompt file that fails to parse should
 * fail the build, not quietly shrink the deck.
 */
export function loadContent(): Content {
  const prompts: Prompt[] = []

  const promptFiles = readdirSync(join(CONTENT_DIR, 'prompts'))
    .filter((f) => f.endsWith('.yaml'))
    .sort()

  for (const file of promptFiles) {
    const parsed = PromptFileSchema.parse(readYaml(`prompts/${file}`))
    for (const p of parsed.prompts) {
      prompts.push({ ...p, region: parsed.region })
    }
  }

  const { fallbacks } = FallbackFileSchema.parse(readYaml('fallbacks.yaml'))
  const { words } = WordFileSchema.parse(readYaml('words.yaml'))

  return { prompts, fallbacks, words }
}

let cached: Content | null = null

/** Content is immutable at runtime, so read it once per process. */
export function content(): Content {
  if (!cached) cached = loadContent()
  return cached
}

/**
 * Prompts eligible for a room: the region's own plus everything global, at or
 * below the chosen content level. The mix is what makes region feel like a
 * flavour rather than a filter.
 */
export function eligiblePrompts(region: Region, level: ContentLevel, all = content().prompts) {
  return all.filter((p) => (p.region === region || p.region === 'global') && p.level <= level)
}
