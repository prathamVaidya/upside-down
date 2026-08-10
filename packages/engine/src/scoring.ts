import type { SeatId, Side } from '@ud/protocol'
import { finalePointsPerVote, roundMultiplier } from './config.ts'
import type { Finale, Matchup, RoomState } from './state.ts'
import { seat } from './state.ts'

export type Tally = { a: number; b: number; cast: number }

export function tally(matchup: Matchup): Tally {
  let a = 0
  let b = 0
  for (const v of Object.values(matchup.votes)) {
    if (v === 'a') a++
    else b++
  }
  return { a, b, cast: a + b }
}

export function outcome(t: Tally): Side | 'tie' {
  if (t.a > t.b) return 'a'
  if (t.b > t.a) return 'b'
  return 'tie'
}

/**
 * A sweep is every vote that was cast going one way, with at least two votes in
 * play.
 *
 * Deliberately measured against votes *cast* rather than voters *eligible*: one
 * person in the loo should not be able to veto the biggest beat in the game.
 * See open question 3 in ARCHITECTURE.md — an unlimited audience changes what
 * this should mean, and that needs a design call before M2.
 */
export function isSweep(t: Tally): boolean {
  return t.cast >= 2 && (t.a === 0 || t.b === 0)
}

/** Total votes each finale entry received, keyed by its author's seat. */
export function finaleTally(finale: Finale): Record<SeatId, number> {
  const totals: Record<SeatId, number> = {}
  for (const entry of finale.entries) totals[entry.seatId] = 0
  for (const spread of Object.values(finale.votes)) {
    for (const [entrySeatId, count] of Object.entries(spread)) {
      totals[entrySeatId] = (totals[entrySeatId] ?? 0) + count
    }
  }
  return totals
}

/**
 * Settle the finale: everybody scores what they earned, the top answer wins,
 * and everybody below it hangs upside down for the winner screen.
 */
export function applyFinaleReveal(state: RoomState, finale: Finale): void {
  const totals = finaleTally(finale)
  const cast = Object.values(totals).reduce((sum, n) => sum + n, 0)
  const best = Math.max(0, ...Object.values(totals))

  // A finale sweep needs every vote in the room on one answer. With three votes
  // each spread across up to eight entries it will almost never happen, which
  // is exactly why it is worth having.
  const leaders = finale.entries.filter((e) => (totals[e.seatId] ?? 0) === best && best > 0)
  const swept = cast >= 2 && leaders.length === 1 && best === cast ? leaders[0]! : null
  finale.sweptBy = swept?.seatId ?? null

  const perVote = finalePointsPerVote(state.config, finale.entries.length, state.round)

  for (const entry of finale.entries) {
    const votes = totals[entry.seatId] ?? 0
    entry.points = votes * perVote
    if (swept?.seatId === entry.seatId) {
      entry.points += state.config.sweepBonus * roundMultiplier(state.config, state.round)
    }

    const author = seat(state, entry.seatId)
    if (!author) continue
    author.score += entry.points
    author.delta += entry.points
    if (swept?.seatId === entry.seatId) author.sweeps++
    // Everyone who did not win the finale ends it upside down.
    author.lostLast = best > 0 && votes < best
  }
}

/**
 * Settle a matchup: award points, mark the loser upside down, bank any sweep.
 * Mutates `state`; called once, on entry to the reveal phase.
 */
export function applyReveal(state: RoomState, matchup: Matchup): void {
  const t = tally(matchup)
  const sweep = isSweep(t)
  const mult = roundMultiplier(state.config, state.round)
  const perVote = state.config.pointsPerVote * mult
  const bonus = state.config.sweepBonus * mult

  matchup.points.a = t.a * perVote + (sweep && t.a > 0 ? bonus : 0)
  matchup.points.b = t.b * perVote + (sweep && t.b > 0 ? bonus : 0)
  matchup.sweep = sweep
  matchup.revealed = true

  const authorA = seat(state, matchup.a.seatId)
  const authorB = seat(state, matchup.b.seatId)

  if (authorA) {
    authorA.score += matchup.points.a
    authorA.delta += matchup.points.a
    if (sweep && t.a > 0) authorA.sweeps++
  }
  if (authorB) {
    authorB.score += matchup.points.b
    authorB.delta += matchup.points.b
    if (sweep && t.b > 0) authorB.sweeps++
  }

  // Losers live upside down. A tie leaves both the right way up.
  const won = outcome(t)
  if (authorA) authorA.lostLast = won === 'b'
  if (authorB) authorB.lostLast = won === 'a'
}
