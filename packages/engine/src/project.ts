import type { ClientView, PhaseView, ScoreRow, SeatId, SeatView, Side } from '@ud/protocol'
import { outcome, tally } from './scoring.ts'
import type { Matchup, RoomState, Seat } from './state.ts'
import { eligibleVoters, seat, writers } from './state.ts'

/**
 * Turn room state into the one thing a given viewer is allowed to see.
 *
 * This is the fairness boundary of the entire game. "Authors hidden until
 * reveal" (mockup 1d) and "yours isn't in this list" (2l) are not view states a
 * component can choose to honour — if authorship crosses the wire early, anyone
 * with devtools open wins. So it is removed here, per recipient, and the client
 * never receives `RoomState` at all.
 *
 * `viewerId` is null for the stage, which has no seat and sees only what the
 * whole room can already see on the television.
 */
export function project(state: RoomState, viewerId: SeatId | null, now: number): ClientView {
  const viewer = seat(state, viewerId)
  return {
    code: state.code,
    serverNow: now,
    phaseEndsAt: state.phaseEndsAt,
    round: state.round,
    roundCount: state.config.roundCount,
    you: viewer ? seatView(state, viewer) : null,
    seats: state.seats.map((s) => seatView(state, s)),
    phase: phaseView(state, viewer ?? null),
  }
}

function seatView(state: RoomState, s: Seat): SeatView {
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    shape: s.shape,
    kind: s.kind,
    connected: s.connected,
    isHost: state.hostSeatId === s.id,
    score: s.score,
    delta: s.delta,
  }
}

function phaseView(state: RoomState, viewer: Seat | null): PhaseView {
  switch (state.phase) {
    case 'lobby':
      return {
        name: 'lobby',
        settings: state.settings,
        settingsOpen: state.settingsOpen,
        playerCount: writers(state).length,
        minPlayers: state.config.minPlayers,
        maxPlayers: state.config.maxPlayers,
        canStart: writers(state).length >= state.config.minPlayers,
      }

    case 'writing':
      return writingView(state, viewer)

    case 'voting':
      return votingView(state, viewer)

    case 'reveal':
      return revealView(state)

    case 'scoreboard':
      return {
        name: 'scoreboard',
        roundJustEnded: state.round,
        nextRound: state.round < state.config.roundCount ? state.round + 1 : null,
        rows: scoreRows(state),
      }

    case 'winner': {
      const rows = scoreRows(state)
      const champion = rows[0]
      const championSeat = seat(state, champion?.seatId ?? null)
      return {
        name: 'winner',
        championSeatId: champion?.seatId ?? '',
        championName: champion?.name ?? 'nobody',
        championScore: champion?.score ?? 0,
        championSweeps: championSeat?.sweeps ?? 0,
        rows,
      }
    }
  }
}

function writingView(state: RoomState, viewer: Seat | null): PhaseView {
  const progress = writers(state).map((w) => {
    const list = state.assignments[w.id] ?? []
    const done = list.filter((a) => state.matchups[a.matchupIndex]?.[a.side]?.submitted).length
    return { seatId: w.id, done, of: list.length }
  })

  // Only ever the viewer's own prompt, and only the one they are still on.
  let assignment: { slot: number; of: number; promptText: string } | null = null
  if (viewer) {
    const list = state.assignments[viewer.id] ?? []
    for (let slot = 0; slot < list.length; slot++) {
      const a = list[slot]!
      const matchup = state.matchups[a.matchupIndex]
      if (matchup && !matchup[a.side].submitted) {
        assignment = { slot, of: list.length, promptText: matchup.promptText }
        break
      }
    }
  }

  return {
    name: 'writing',
    assignment,
    progress,
    submittedCount: progress.filter((p) => p.done === p.of).length,
    writerCount: progress.length,
  }
}

function votingView(state: RoomState, viewer: Seat | null): PhaseView {
  const matchup = state.matchups[state.matchupIndex]
  if (!matchup) throw new Error('voting phase with no matchup')

  const t = tally(matchup)
  const yourSide: Side | null =
    viewer && viewer.id === matchup.a.seatId
      ? 'a'
      : viewer && viewer.id === matchup.b.seatId
        ? 'b'
        : null

  return {
    name: 'voting',
    matchupNumber: state.matchupIndex + 1,
    matchupCount: state.matchups.length,
    promptText: matchup.promptText,
    // Note the absence: no seat ids, no names, no fallback flags. Authorship
    // does not exist in this object.
    a: { text: matchup.a.text, votes: t.a },
    b: { text: matchup.b.text, votes: t.b },
    yourSide,
    youMayVote: viewer !== null && yourSide === null && viewer.connected,
    yourVote: viewer ? (matchup.votes[viewer.id] ?? null) : null,
    votesIn: t.cast,
    votersExpected: eligibleVoters(state, matchup).length,
  }
}

function revealView(state: RoomState): PhaseView {
  const matchup = state.matchups[state.matchupIndex]
  if (!matchup) throw new Error('reveal phase with no matchup')

  const t = tally(matchup)
  const side = (which: 'a' | 'b') => ({
    text: matchup[which].text,
    votes: which === 'a' ? t.a : t.b,
    points: matchup.points[which],
    authorSeatId: matchup[which].seatId,
    authorName: seat(state, matchup[which].seatId)?.name ?? 'someone',
    fallback: matchup[which].fallback,
  })

  return {
    name: 'reveal',
    matchupNumber: state.matchupIndex + 1,
    matchupCount: state.matchups.length,
    promptText: matchup.promptText,
    a: side('a'),
    b: side('b'),
    winner: outcome(t),
    sweep: matchup.sweep,
  }
}

function scoreRows(state: RoomState): ScoreRow[] {
  return state.seats
    .filter((s) => s.kind === 'player')
    .slice()
    .sort((x, y) => y.score - x.score || x.joinedAt - y.joinedAt)
    .map((s) => ({
      seatId: s.id,
      name: s.name,
      color: s.color,
      shape: s.shape,
      score: s.score,
      delta: s.delta,
      upsideDown: s.lostLast,
    }))
}

/** Exported for the redaction test, which needs to enumerate every matchup. */
export function matchupsOf(state: RoomState): Matchup[] {
  return state.matchups
}
