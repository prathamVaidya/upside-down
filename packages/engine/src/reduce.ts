import type { SeatId } from '@ud/protocol'
import type { Ctx } from './ctx.ts'
import type { Effect, Event } from './events.ts'
import type { RoomState, Seat } from './state.ts'
import { identityFor, players, seat, votesSpent, writers } from './state.ts'
import {
  advanceAfterReveal,
  advanceAfterScoreboard,
  arm,
  beginNextRound,
  currentMatchup,
  enterFinaleReveal,
  enterFinaleVoting,
  enterReveal,
  enterVoting,
  enterWinner,
  fillFallbacks,
  finaleVotingComplete,
  votingComplete,
  writingComplete,
} from './transitions.ts'

export type Reduced = { state: RoomState; effects: Effect[] }

/**
 * The whole game, as a function.
 *
 * Deep-clone then mutate: the state is a handful of seats and matchups, so the
 * clone is far cheaper than the class of aliasing bugs that hand-written
 * immutable updates invite. Callers get a genuinely new object every time and
 * can keep the old one for replay or diffing.
 */
export function reduce(state: RoomState, event: Event, ctx: Ctx): Reduced {
  const next = structuredClone(state)
  const effects: Effect[] = []
  apply(next, event, ctx, effects)
  if (!effects.some((e) => e.kind === 'broadcast')) effects.push({ kind: 'broadcast' })
  return { state: next, effects }
}

type RejectCode = Extract<Effect, { kind: 'reject' }>['code']

/** Say no to one client without throwing, and without telling the room. */
function reject(effects: Effect[], seatId: SeatId, code: RejectCode, message: string): void {
  effects.push({ kind: 'reject', seatId, code, message })
}

function apply(state: RoomState, event: Event, ctx: Ctx, effects: Effect[]): void {
  switch (event.type) {
    case 'seat.join':
      onJoin(state, event, ctx, effects)
      break
    case 'seat.resume':
      onResume(state, event, effects)
      break
    case 'seat.disconnect':
      onDisconnect(state, event, ctx, effects)
      break
    case 'settings.set':
      onSettingsSet(state, event, effects)
      break
    case 'settings.open':
      onSettingsOpen(state, event, effects)
      break
    case 'game.start':
      onStart(state, event, ctx, effects)
      break
    case 'answer.submit':
      onSubmit(state, event, ctx, effects)
      break
    case 'vote.cast':
      onVote(state, event, ctx, effects)
      break
    case 'finale.vote':
      onFinaleVote(state, event, ctx, effects)
      break
    case 'deadline':
      onDeadline(state, event, ctx, effects)
      break
    case 'host.check':
      onHostCheck(state, event, effects)
      break
  }
}

function onJoin(
  state: RoomState,
  event: Extract<Event, { type: 'seat.join' }>,
  ctx: Ctx,
  effects: Effect[],
): void {
  const name = event.name.trim()
  const taken = state.seats.some((s) => s.name.toLowerCase() === name.toLowerCase())
  if (taken) {
    reject(effects, event.seatId, 'NAME_TAKEN', `${name} is taken. pick another.`)
    return
  }

  // Anyone arriving after the lobby watches and votes but never writes — the
  // audience role exists precisely so a late arrival is never turned away.
  const roomOpen = state.phase === 'lobby'
  const seatsFree = players(state).length < state.config.maxPlayers
  const kind: Seat['kind'] =
    event.kind === 'player' && roomOpen && seatsFree ? 'player' : 'audience'

  const { color, shape } = identityFor(state.seats.length)
  state.seats.push({
    id: event.seatId,
    token: event.token,
    name,
    kind,
    color,
    shape,
    connected: true,
    joinedAt: ctx.now,
    score: 0,
    delta: 0,
    sweeps: 0,
    lostLast: false,
  })

  if (state.hostSeatId === null && kind === 'player') state.hostSeatId = event.seatId
  effects.push({ kind: 'sound', cue: 'join' })
}

function onResume(
  state: RoomState,
  event: Extract<Event, { type: 'seat.resume' }>,
  effects: Effect[],
): void {
  const s = seat(state, event.seatId)
  if (!s) {
    reject(effects, event.seatId, 'SEAT_NOT_FOUND', 'that seat is gone. join again.')
    return
  }
  s.connected = true
}

function onDisconnect(
  state: RoomState,
  event: Extract<Event, { type: 'seat.disconnect' }>,
  ctx: Ctx,
  effects: Effect[],
): void {
  const s = seat(state, event.seatId)
  if (!s) return
  s.connected = false

  if (state.hostSeatId === s.id) {
    effects.push({
      kind: 'schedule',
      at: ctx.now + state.config.hostGraceMs,
      event: { type: 'host.check', seatId: s.id },
    })
  }

  // A departure can complete the vote for everybody still here.
  if (state.phase === 'voting') {
    const matchup = currentMatchup(state)
    if (matchup && votingComplete(state, matchup)) {
      arm(state, effects, ctx.now + state.config.settleMs)
    }
  }
  if (state.phase === 'finaleVoting' && finaleVotingComplete(state)) {
    arm(state, effects, ctx.now + state.config.settleMs)
  }
}

function onHostCheck(
  state: RoomState,
  event: Extract<Event, { type: 'host.check' }>,
  _effects: Effect[],
): void {
  if (state.hostSeatId !== event.seatId) return
  const host = seat(state, event.seatId)
  if (host?.connected) return

  const heir = state.seats
    .filter((s) => s.kind === 'player' && s.connected)
    .sort((a, b) => a.joinedAt - b.joinedAt)[0]
  state.hostSeatId = heir?.id ?? null
}

function onSettingsSet(
  state: RoomState,
  event: Extract<Event, { type: 'settings.set' }>,
  effects: Effect[],
): void {
  if (state.hostSeatId !== event.seatId) {
    reject(effects, event.seatId, 'NOT_HOST', 'only the host picks the room.')
    return
  }
  if (state.phase !== 'lobby') return
  state.settings = { region: event.region, level: event.level }
}

function onSettingsOpen(
  state: RoomState,
  event: Extract<Event, { type: 'settings.open' }>,
  effects: Effect[],
): void {
  if (state.hostSeatId !== event.seatId) {
    reject(effects, event.seatId, 'NOT_HOST', 'only the host picks the room.')
    return
  }
  if (state.phase !== 'lobby') return
  state.settingsOpen = event.open
}

function onStart(
  state: RoomState,
  event: Extract<Event, { type: 'game.start' }>,
  ctx: Ctx,
  effects: Effect[],
): void {
  if (state.hostSeatId !== event.seatId) {
    reject(effects, event.seatId, 'NOT_HOST', 'only the host can start this.')
    return
  }
  if (state.phase !== 'lobby') return
  if (writers(state).length < state.config.minPlayers) {
    reject(
      effects,
      event.seatId,
      'GAME_IN_PROGRESS',
      `the game needs ${state.config.minPlayers}. text somebody.`,
    )
    return
  }
  state.settingsOpen = false
  beginNextRound(state, ctx, effects)
}

function onSubmit(
  state: RoomState,
  event: Extract<Event, { type: 'answer.submit' }>,
  ctx: Ctx,
  effects: Effect[],
): void {
  if (state.phase !== 'writing') return

  const assignment = state.assignments[event.seatId]?.[event.slot]
  if (!assignment) return

  const text = event.text.trim()
  if (text.length === 0) {
    reject(effects, event.seatId, 'BAD_MESSAGE', 'write something first.')
    return
  }

  const answer =
    assignment.kind === 'finale'
      ? state.finale?.entries.find((e) => e.seatId === event.seatId)
      : state.matchups[assignment.matchupIndex]?.[assignment.side]

  if (!answer || answer.seatId !== event.seatId) return
  if (answer.submitted) return

  answer.text = text
  answer.submitted = true
  effects.push({ kind: 'sound', cue: 'submit' })

  // Everyone finished early — no reason to make the room watch a dead clock.
  if (writingComplete(state)) {
    if (state.finale) enterFinaleVoting(state, ctx, effects)
    else enterVoting(state, ctx, effects, 0)
  }
}

function onVote(
  state: RoomState,
  event: Extract<Event, { type: 'vote.cast' }>,
  ctx: Ctx,
  effects: Effect[],
): void {
  if (state.phase !== 'voting') return
  const matchup = currentMatchup(state)
  if (!matchup) return

  const voter = seat(state, event.seatId)
  if (!voter?.connected) return
  // The two authors sit their own matchup out (mockup 2k).
  if (voter.id === matchup.a.seatId || voter.id === matchup.b.seatId) return
  // No takebacks.
  if (matchup.votes[voter.id] !== undefined) return

  matchup.votes[voter.id] = event.side
  effects.push({ kind: 'sound', cue: 'vote-land' })

  if (votingComplete(state, matchup)) {
    arm(state, effects, ctx.now + state.config.settleMs)
  }
}

function onFinaleVote(
  state: RoomState,
  event: Extract<Event, { type: 'finale.vote' }>,
  ctx: Ctx,
  effects: Effect[],
): void {
  if (state.phase !== 'finaleVoting') return
  const finale = state.finale
  if (!finale) return

  const voter = seat(state, event.seatId)
  if (!voter?.connected) return
  // You cannot vote for yourself — mockup 2l keeps your own answer off the list
  // entirely, and the projection does the same, but never trust the client.
  if (voter.id === event.entrySeatId) return
  if (!finale.entries.some((e) => e.seatId === event.entrySeatId)) return

  finale.votes[voter.id] ??= {}
  const spread = finale.votes[voter.id]!
  const current = spread[event.entrySeatId] ?? 0

  if (event.delta === 1) {
    if (votesSpent(finale, voter.id) >= state.config.votesPerFinaleVoter) return
    spread[event.entrySeatId] = current + 1
    effects.push({ kind: 'sound', cue: 'vote-land' })
  } else {
    if (current <= 0) return
    if (current === 1) delete spread[event.entrySeatId]
    else spread[event.entrySeatId] = current - 1
  }

  if (finaleVotingComplete(state)) {
    arm(state, effects, ctx.now + state.config.settleMs)
  }
}

function onDeadline(
  state: RoomState,
  event: Extract<Event, { type: 'deadline' }>,
  ctx: Ctx,
  effects: Effect[],
): void {
  // A timer from a phase we have already left.
  if (event.token !== state.timerToken) return

  switch (state.phase) {
    case 'writing':
      fillFallbacks(state, ctx)
      if (state.finale) enterFinaleVoting(state, ctx, effects)
      else enterVoting(state, ctx, effects, 0)
      break
    case 'voting':
      enterReveal(state, ctx, effects)
      break
    case 'reveal':
      advanceAfterReveal(state, ctx, effects)
      break
    case 'finaleVoting':
      enterFinaleReveal(state, ctx, effects)
      break
    case 'finaleReveal':
      // The finale is always the last round, so its reveal runs straight into
      // the winner rather than another scoreboard.
      enterWinner(state, ctx, effects)
      break
    case 'scoreboard':
      advanceAfterScoreboard(state, ctx, effects)
      break
    case 'lobby':
    case 'winner':
      break
  }
}
