import {
  eligibleVoters,
  finaleTally,
  finaleVoters,
  type RoomState,
  tally,
  votesSpent,
  writers,
} from '@ud/engine'
import type { WideEvent } from './telemetry.ts'

export const scoreSummary = (state: RoomState) =>
  state.seats
    .filter((s) => s.kind === 'player')
    .map((s) => ({ player_id: s.id, score: s.score, delta: s.delta, sweeps: s.sweeps }))

/** Observe committed state changes; never serialize state or user-authored content. */
export function lifecycleEvents(before: RoomState, after: RoomState): WideEvent[] {
  const events: WideEvent[] = []
  if (before.hostSeatId !== after.hostSeatId)
    events.push({
      event: 'host.changed',
      previous_host_id: before.hostSeatId,
      host_id: after.hostSeatId,
      reason:
        before.hostSeatId === null
          ? 'assigned'
          : after.hostSeatId === null
            ? 'no_connected_players'
            : 'transferred',
    })
  if (after.round !== before.round) events.push({ event: 'round.started' })
  if (before.phase !== after.phase) {
    events.push({ event: 'phase.changed' })
    if (before.phase === 'writing') {
      const answers = after.finale?.entries ?? after.matchups.flatMap((m) => [m.a, m.b])
      const fallbackCount = answers.filter((a) => a.fallback).length
      events.push({
        event: 'writing.completed',
        fallback_count: fallbackCount,
        reason: fallbackCount ? 'timeout' : 'all_submitted',
      })
    }
    if (before.phase === 'voting') {
      const matchup = before.matchups[before.matchupIndex]
      if (matchup) {
        const eligible = eligibleVoters(before, matchup)
        const missing = eligible.filter((s) => matchup.votes[s.id] === undefined).length
        events.push({
          event: 'voting.completed',
          missing_votes: missing,
          reason: missing
            ? 'timeout'
            : eligible.length
              ? 'all_eligible_votes_cast'
              : 'no_eligible_voters',
        })
      }
    }
    if (before.phase === 'finaleVoting' && before.finale) {
      const finale = before.finale
      const eligible = finaleVoters(before).filter((s) =>
        finale.entries.some((e) => e.seatId !== s.id),
      )
      const missing = eligible.reduce(
        (sum, s) =>
          sum +
          (finale.entries.some((e) => e.seatId !== s.id)
            ? Math.max(0, before.config.votesPerFinaleVoter - votesSpent(finale, s.id))
            : 0),
        0,
      )
      events.push({
        event: 'voting.completed',
        missing_votes: missing,
        reason: missing
          ? 'timeout'
          : eligible.length
            ? 'all_eligible_votes_cast'
            : 'no_eligible_voters',
      })
    }
    if (after.phase === 'voting' || after.phase === 'finaleVoting')
      events.push({ event: 'voting.started' })
    if (after.phase === 'scoreboard' || after.phase === 'finaleReveal') {
      events.push({ event: 'round.completed', scores: scoreSummary(after) })
    }
    if (after.phase === 'finaleReveal' && after.finale) {
      const totals = finaleTally(after.finale)
      const best = Math.max(0, ...Object.values(totals))
      events.push({
        event: 'finale.result',
        sweep: after.finale.sweptBy !== null,
        winner_ids: after.finale.entries
          .filter((e) => totals[e.seatId] === best && best > 0)
          .map((e) => e.seatId),
        entries: after.finale.entries.map((e) => ({
          player_id: e.seatId,
          votes: totals[e.seatId] ?? 0,
          points: e.points,
          fallback: e.fallback,
        })),
      })
    }
  }
  if (before.round === after.round)
    after.matchups.forEach((m, index) => {
      if (!m.revealed || before.matchups[index]?.revealed) return
      const votes = tally(m)
      events.push({
        event: 'matchup.result',
        matchup_index: index,
        prompt_id: m.promptId,
        votes_a: votes.a,
        votes_b: votes.b,
        points_a: m.points.a,
        points_b: m.points.b,
        author_a: m.a.seatId,
        author_b: m.b.seatId,
        sweep: m.sweep,
        fallback_count: Number(m.a.fallback) + Number(m.b.fallback),
      })
    })
  if (!before.ended && after.ended) {
    const completed =
      before.phase === 'finaleReveal' ||
      (before.phase === 'scoreboard' && after.round >= after.config.roundCount)
    const scores = scoreSummary(after)
    const best = Math.max(...scores.map((s) => s.score))
    events.push({
      event: completed ? 'game.completed' : 'game.ended_early',
      reason: completed
        ? 'all_rounds_completed'
        : writers(after).length < after.config.minPlayers
          ? 'insufficient_players'
          : 'invalid_game_state',
      scores,
      winner_ids: scores.filter((s) => s.score === best).map((s) => s.player_id),
    })
  }
  return events
}
