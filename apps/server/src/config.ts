import { DEFAULT_CONFIG, type EngineConfig } from '@ud/engine'

const num = (name: string, fallback: number): number => {
  const raw = process.env[name]
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** What `UD_FAST=1` collapses every clock to. */
const FAST = {
  writingMs: 2_000,
  votingMs: 1_500,
  finaleVotingMs: 2_500,
  revealMs: 250,
  sweepRevealMs: 350,
  finaleRevealMs: 400,
  scoreboardMs: 300,
  settleMs: 50,
  hostGraceMs: 1_000,
}

/**
 * Room rules for this process.
 *
 * `UD_FAST=1` collapses every phase clock so the bot game plays a full match in
 * seconds. That is too fast for a browser test, though — Cypress has to
 * actually type into the writing phase — so each clock can also be set on its
 * own, which is what the E2E run does.
 *
 * Durations only. None of this changes a rule, so a fast game and a real one
 * take exactly the same path through the reducer.
 */
export function configFromEnv(): EngineConfig {
  const base = process.env.UD_FAST === '1' ? { ...DEFAULT_CONFIG, ...FAST } : DEFAULT_CONFIG
  const rounds = num('UD_ROUNDS', DEFAULT_CONFIG.roundCount)

  return {
    ...base,
    roundCount: rounds,
    minPlayers: num('UD_MIN_PLAYERS', DEFAULT_CONFIG.minPlayers),
    // The finale is always the last round, however many there are.
    finaleRound: process.env.UD_NO_FINALE === '1' ? null : rounds,

    writingMs: num('UD_WRITING_MS', base.writingMs),
    votingMs: num('UD_VOTING_MS', base.votingMs),
    finaleVotingMs: num('UD_FINALE_VOTING_MS', base.finaleVotingMs),
    revealMs: num('UD_REVEAL_MS', base.revealMs),
    sweepRevealMs: num('UD_SWEEP_REVEAL_MS', base.sweepRevealMs),
    finaleRevealMs: num('UD_FINALE_REVEAL_MS', base.finaleRevealMs),
    scoreboardMs: num('UD_SCOREBOARD_MS', base.scoreboardMs),
    settleMs: num('UD_SETTLE_MS', base.settleMs),
    hostGraceMs: num('UD_HOST_GRACE_MS', base.hostGraceMs),
  }
}
