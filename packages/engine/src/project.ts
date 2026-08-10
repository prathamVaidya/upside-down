import type { ClientView, PhaseView, ScoreRow, SeatId, SeatView, Side } from '@ud/protocol'
import { finaleTally, outcome, tally } from './scoring.ts'
import type { Assignment, Matchup, RoomState, Seat } from './state.ts'
import { eligibleVoters, finaleVoters, seat, votesSpent, writers } from './state.ts'

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

    case 'finaleVoting':
      return finaleVotingView(state, viewer)

    case 'finaleReveal':
      return finaleRevealView(state)

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

/** Has this seat answered the prompt this assignment points at? */
function assignmentDone(state: RoomState, seatId: SeatId, assignment: Assignment): boolean {
  if (assignment.kind === 'finale') {
    return state.finale?.entries.find((e) => e.seatId === seatId)?.submitted ?? false
  }
  return state.matchups[assignment.matchupIndex]?.[assignment.side]?.submitted ?? false
}

function promptOf(state: RoomState, assignment: Assignment): string | null {
  if (assignment.kind === 'finale') return state.finale?.promptText ?? null
  return state.matchups[assignment.matchupIndex]?.promptText ?? null
}

function writingView(state: RoomState, viewer: Seat | null): PhaseView {
  const progress = writers(state).map((w) => {
    const list = state.assignments[w.id] ?? []
    return {
      seatId: w.id,
      done: list.filter((a) => assignmentDone(state, w.id, a)).length,
      of: list.length,
    }
  })

  // Only ever the viewer's own prompt, and only the one they are still on. In
  // the finale everybody has the same one, so there is nothing to hide — but
  // the code path is identical either way.
  let assignment: { slot: number; of: number; promptText: string } | null = null
  if (viewer) {
    const list = state.assignments[viewer.id] ?? []
    for (let slot = 0; slot < list.length; slot++) {
      const a = list[slot]!
      const promptText = promptOf(state, a)
      if (promptText && !assignmentDone(state, viewer.id, a)) {
        assignment = { slot, of: list.length, promptText }
        break
      }
    }
  }

  return {
    name: 'writing',
    isFinale: state.finale !== null,
    assignment,
    progress,
    submittedCount: progress.filter((p) => p.done === p.of).length,
    writerCount: progress.length,
  }
}

function finaleVotingView(state: RoomState, viewer: Seat | null): PhaseView {
  const finale = state.finale
  if (!finale) throw new Error('finale voting with no finale')

  const totals = finaleTally(finale)
  const yourSpread = viewer ? (finale.votes[viewer.id] ?? {}) : {}
  const spent = viewer ? votesSpent(finale, viewer.id) : 0

  const entries = finale.entries.map((entry) => ({
    // The entry is keyed by its author's seat because that is what makes it
    // unique — but nothing here says *whose* it is, and `authorName` does not
    // exist on this type. The client cannot render what it was not sent.
    id: entry.seatId,
    text: entry.text,
    votes: totals[entry.seatId] ?? 0,
    isYours: viewer?.id === entry.seatId,
    yourVotes: yourSpread[entry.seatId] ?? 0,
  }))

  const voters = finaleVoters(state)
  return {
    name: 'finaleVoting',
    promptText: finale.promptText,
    entries,
    votesPerVoter: state.config.votesPerFinaleVoter,
    votesLeft: viewer ? Math.max(0, state.config.votesPerFinaleVoter - spent) : 0,
    votesIn: Object.values(totals).reduce((sum, n) => sum + n, 0),
    votesPossible: voters.length * state.config.votesPerFinaleVoter,
  }
}

function finaleRevealView(state: RoomState): PhaseView {
  const finale = state.finale
  if (!finale) throw new Error('finale reveal with no finale')

  const totals = finaleTally(finale)
  const best = Math.max(0, ...finale.entries.map((e) => totals[e.seatId] ?? 0))

  return {
    name: 'finaleReveal',
    promptText: finale.promptText,
    entries: finale.entries
      .map((entry) => {
        const author = seat(state, entry.seatId)
        const votes = totals[entry.seatId] ?? 0
        return {
          seatId: entry.seatId,
          authorName: author?.name ?? 'someone',
          color: author?.color ?? ('sage' as const),
          shape: author?.shape ?? ('pebble' as const),
          text: entry.text,
          votes,
          points: entry.points,
          fallback: entry.fallback,
          won: best > 0 && votes === best,
        }
      })
      .sort((a, b) => b.votes - a.votes),
    winnerSeatId:
      finale.entries.find((e) => (totals[e.seatId] ?? 0) === best && best > 0)?.seatId ?? null,
    sweep: finale.sweptBy !== null,
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
