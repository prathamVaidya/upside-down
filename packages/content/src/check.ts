/**
 * `bun run content:check` — the CI gate on `content/`.
 *
 * Content is the one part of this repo a non-programmer is expected to send a PR
 * against, so the failure messages here matter more than most. Say which file,
 * which id, and what to do.
 */
import { REGIONS } from '@ud/protocol'
import { loadContent } from './load.ts'
import { PROMPT_MAX } from './schema.ts'

/** Deliberately short. Expand as needed; this is a floor, not a filter. */
const BANNED = ['retard', 'tranny', 'faggot', 'nigger', 'paki', 'chink', 'spastic']

const problems: string[] = []
const fail = (msg: string) => problems.push(msg)

const { prompts, fallbacks, words } = loadContent()

// Unique ids.
const seenIds = new Map<string, string>()
for (const p of prompts) {
  const previous = seenIds.get(p.id)
  if (previous) fail(`duplicate id ${p.id} — already used for "${previous}"`)
  seenIds.set(p.id, p.text)
}

// Duplicate text, normalised. Catches the same joke landing in two regions.
const seenText = new Map<string, string>()
const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
for (const p of prompts) {
  const key = normalise(p.text)
  const previous = seenText.get(key)
  if (previous) fail(`${p.id} duplicates ${previous}: "${p.text}"`)
  seenText.set(key, p.id)
}

// Length ceiling and shape.
for (const p of prompts) {
  if (p.text.length > PROMPT_MAX) {
    fail(`${p.id} is ${p.text.length} chars, over the ${PROMPT_MAX} ceiling`)
  }
  if (/[.!?]$/.test(p.text)) {
    fail(`${p.id} ends with punctuation — prompts are fragments, not sentences`)
  }
  if (p.text[0] !== p.text[0]?.toUpperCase()) {
    fail(`${p.id} should start with a capital: "${p.text}"`)
  }
}

// Wordlist.
for (const p of prompts) {
  const lower = p.text.toLowerCase()
  for (const bad of BANNED) if (lower.includes(bad)) fail(`${p.id} contains a banned term`)
}
for (const w of words) {
  for (const bad of BANNED)
    if (w.includes(bad)) fail(`room-code word "${w}" contains a banned term`)
}

// Room codes must be unique or the allocator will loop.
const seenWords = new Set<string>()
for (const w of words) {
  if (seenWords.has(w)) fail(`duplicate room-code word "${w}"`)
  seenWords.add(w)
}

// Deck depth. A game needs 2n+1 prompts; at 8 players that is 17. Below ~60 per
// region/level, repeat sessions start feeling stale.
for (const region of REGIONS) {
  if (region === 'global') continue
  for (const level of [1, 2, 3] as const) {
    const n = prompts.filter(
      (p) => (p.region === region || p.region === 'global') && p.level <= level,
    ).length
    if (n < 17) fail(`${region} at level ${level} has only ${n} prompts — a full game needs 17`)
    else if (n < 60) console.warn(`  thin: ${region} level ${level} has ${n} prompts (want 60+)`)
  }
}

if (fallbacks.length < 8) fail(`only ${fallbacks.length} fallback answers — want at least 8`)

if (problems.length > 0) {
  console.error(`\ncontent:check failed with ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error('')
  process.exit(1)
}

console.log(
  `content:check ok — ${prompts.length} prompts, ${fallbacks.length} fallbacks, ${words.length} room codes`,
)
