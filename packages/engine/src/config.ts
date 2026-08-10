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
  /**
   * Which round is the finale — everyone answers one prompt and voters split
   * three votes across all the answers. Null runs every round as a normal
   * head-to-head, which is what the engine tests want.
   */
  finaleRound: number | null
  writingMs: number
  votingMs: number
  /** The finale has more to read, so it gets longer. */
  finaleVotingMs: number
  revealMs: number
  /** A sweep gets longer on screen; it is the biggest beat in the game. */
  sweepRevealMs: number
  finaleRevealMs: number
  scoreboardMs: number
  /** Beat between the last vote landing and the reveal, so it does not snap. */
  settleMs: number
  /** Grace before a disconnected host loses the room. */
  hostGraceMs: number
  pointsPerVote: number
  sweepBonus: number
  votesPerFinaleVoter: number
  /** Indexed by round - 1. Round 2 is double points, the finale is triple. */
  roundMultipliers: number[]
}

export const DEFAULT_CONFIG: EngineConfig = {
  minPlayers: 3,
  maxPlayers: 8,
  // Round 1 normal, round 2 double points, round 3 the finale.
  roundCount: 3,
  finaleRound: 3,
  writingMs: 60_000,
  votingMs: 20_000,
  finaleVotingMs: 35_000,
  revealMs: 6_000,
  sweepRevealMs: 9_000,
  finaleRevealMs: 12_000,
  scoreboardMs: 9_000,
  settleMs: 900,
  hostGraceMs: 30_000,
  pointsPerVote: 200,
  sweepBonus: 400,
  votesPerFinaleVoter: 3,
  roundMultipliers: [1, 2, 3],
}

export const roundMultiplier = (config: EngineConfig, round: number): number =>
  config.roundMultipliers[round - 1] ?? 1

/**
 * What one finale vote is worth, given how many answers are in play.
 *
 * This has to be derived rather than fixed, because the two round shapes scale
 * with the room in opposite directions. A normal round pays out
 * `n × (n − 2) × pointsPerVote` — n matchups, each judged by everyone who did
 * not write it — so it starves at three players, where each matchup has exactly
 * one eligible voter. The finale always pays `n × votesPerFinaleVoter` votes
 * regardless of n.
 *
 * A flat rate therefore made the finale worth a quarter of the game at eight
 * players and four fifths of it at three, which is not a difficulty curve, it
 * is a bug. Equalising against a normal round and then applying the round
 * multiplier — the "triple stakes" the mockups promise — holds the finale at a
 * consistent share of the game whatever the room size.
 */
export function finalePointsPerVote(
  config: EngineConfig,
  entryCount: number,
  round: number,
): number {
  const votersPerMatchup = Math.max(1, entryCount - 2)
  return Math.round(
    (config.pointsPerVote * votersPerMatchup * roundMultiplier(config, round)) /
      config.votesPerFinaleVoter,
  )
}
