/**
 * Every tunable number in the game, in one place.
 *
 * The mockups disagree with each other on scoring — 2c shows +1200/+800/+400/+0
 * for a round, 1e shows four votes paying +800. They are illustrative, so the
 * numbers below are a starting point that needs real play to settle. See open
 * question 2 in ARCHITECTURE.md.
 */
export type EngineConfig = {
  minPlayers: number
  maxPlayers: number
  roundCount: number
  writingMs: number
  votingMs: number
  revealMs: number
  /** A sweep gets longer on screen; it is the biggest beat in the game. */
  sweepRevealMs: number
  scoreboardMs: number
  /** Beat between the last vote landing and the reveal, so it does not snap. */
  settleMs: number
  /** Grace before a disconnected host loses the room. */
  hostGraceMs: number
  pointsPerVote: number
  sweepBonus: number
  /** Indexed by round - 1. Round 2 is double points. */
  roundMultipliers: number[]
}

export const DEFAULT_CONFIG: EngineConfig = {
  minPlayers: 3,
  maxPlayers: 8,
  // M1 ships one round. The loop below is written for N; M2 turns this up to 3
  // and adds the finale as its own phase.
  roundCount: 1,
  writingMs: 60_000,
  votingMs: 20_000,
  revealMs: 6_000,
  sweepRevealMs: 9_000,
  scoreboardMs: 9_000,
  settleMs: 900,
  hostGraceMs: 30_000,
  pointsPerVote: 200,
  sweepBonus: 400,
  roundMultipliers: [1, 2, 3],
}

export const roundMultiplier = (config: EngineConfig, round: number): number =>
  config.roundMultipliers[round - 1] ?? 1
