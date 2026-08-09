import { DEFAULT_CONFIG, type EngineConfig } from '@ud/engine'

const num = (name: string, fallback: number): number => {
  const raw = process.env[name]
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Room rules for this process.
 *
 * `UD_FAST=1` collapses every phase clock so the bot game can play a full match
 * in a couple of seconds. It changes only durations — never the rules — so a
 * fast game and a real one take exactly the same path through the reducer.
 */
export function configFromEnv(): EngineConfig {
  const fast = process.env.UD_FAST === '1'

  return {
    ...DEFAULT_CONFIG,
    roundCount: num('UD_ROUNDS', DEFAULT_CONFIG.roundCount),
    minPlayers: num('UD_MIN_PLAYERS', DEFAULT_CONFIG.minPlayers),
    ...(fast
      ? {
          writingMs: 2_000,
          votingMs: 1_500,
          revealMs: 250,
          sweepRevealMs: 350,
          scoreboardMs: 300,
          settleMs: 50,
          hostGraceMs: 1_000,
        }
      : {}),
  }
}
