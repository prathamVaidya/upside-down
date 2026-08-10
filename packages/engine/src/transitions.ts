import type { Ctx } from './ctx.ts'
import { drawPrompts } from './deck.ts'
import type { Effect } from './events.ts'
import { chooseOrder, cyclePairs } from './pairing.ts'
import { pick } from './rng.ts'
import { applyFinaleReveal, applyReveal, isSweep, tally } from './scoring.ts'
import type { Matchup, RoomState } from './state.ts'
import { eligibleVoters, finaleVoters, pairKey, votesSpent, writers } from './state.ts'

/**
 * Put a clock on the current phase.
 *
 * Bumping `timerToken` invalidates any deadline already in flight, which is what
 * stops a `setTimeout` armed for the voting phase from firing after an early
 * finish has already moved everyone on to the reveal.
 */
function arm(state: RoomState, effects: Effect[], at: number): void {
  state.timerToken++
  state.phaseEndsAt = at
  effects.push({ kind: 'schedule', at, event: { type: 'deadline', token: state.timerToken } })
}

/** Cancel any deadline in flight without setting a new one. */
function disarm(state: RoomState): void {
  state.timerToken++
  state.phaseEndsAt = null
}

/** Reset the per-round bookkeeping every round opens with. */
function openRound(state: RoomState): void {
  state.round++
  for (const s of state.seats) {
    s.delta = 0
    s.lostLast = false
  }
}

/**
 * The finale: one prompt for everybody, one answer each.
 *
 * It rides the same `writing` phase and the same `assignments` map as a normal
 * round, so the phone's writing screen does not have to know the difference —
 * it just receives one prompt instead of two.
 */
export function enterFinaleWriting(state: RoomState, ctx: Ctx, effects: Effect[]): void {
  openRound(state)

  const [prompt] = drawPrompts(state, ctx.library, 1)
  const entrants = writers(state)

  state.matchups = []
  state.matchupIndex = 0
  state.finale = {
    promptId: prompt!.id,
    promptText: prompt!.text,
    entries: entrants.map((s) => ({
      seatId: s.id,
      text: '',
      submitted: false,
      fallback: false,
      points: 0,
    })),
    votes: {},
    sweptBy: null,
  }

  state.assignments = {}
  for (const s of entrants) state.assignments[s.id] = [{ kind: 'finale' }]

  state.phase = 'writing'
  arm(state, effects, ctx.now + state.config.writingMs)
  effects.push({ kind: 'sound', cue: 'start' })
}

export function enterFinaleVoting(state: RoomState, ctx: Ctx, effects: Effect[]): void {
  state.phase = 'finaleVoting'
  arm(state, effects, ctx.now + state.config.finaleVotingMs)
}

/** Everyone has spent every vote they had. */
export function finaleVotingComplete(state: RoomState): boolean {
  const finale = state.finale
  if (!finale) return false
  const voters = finaleVoters(state)
  if (voters.length === 0) return false
  return voters.every((v) => {
    // A player cannot vote for their own answer, so with only their own entry
    // on the ballot there is nothing for them to spend votes on.
    const available = finale.entries.filter((e) => e.seatId !== v.id).length
    return available === 0 || votesSpent(finale, v.id) >= state.config.votesPerFinaleVoter
  })
}

export function enterFinaleReveal(state: RoomState, ctx: Ctx, effects: Effect[]): void {
  const finale = state.finale
  if (!finale) {
    enterWinner(state, ctx, effects)
    return
  }

  applyFinaleReveal(state, finale)
  state.phase = 'finaleReveal'
  arm(state, effects, ctx.now + state.config.finaleRevealMs)
  effects.push({ kind: 'sound', cue: finale.sweptBy ? 'sweep' : 'flip' })
}

export function enterWriting(state: RoomState, ctx: Ctx, effects: Effect[]): void {
  openRound(state)
  state.finale = null

  const ids = writers(state).map((s) => s.id)
  const order = chooseOrder(state, ids, state.pastPairs)
  const pairs = cyclePairs(order)
  const prompts = drawPrompts(state, ctx.library, pairs.length)

  state.matchups = pairs.map(([a, b], i) => ({
    promptId: prompts[i]!.id,
    promptText: prompts[i]!.text,
    a: { seatId: a, text: '', submitted: false, fallback: false },
    b: { seatId: b, text: '', submitted: false, fallback: false },
    votes: {},
    points: { a: 0, b: 0 },
    sweep: false,
    revealed: false,
  }))

  for (const [a, b] of pairs) state.pastPairs.push(pairKey(a, b))

  // Player at position i writes side A of matchup i and side B of the one
  // before it — the two edges the cycle gives them.
  state.assignments = {}
  order.forEach((id, i) => {
    state.assignments[id] = [
      { kind: 'matchup', matchupIndex: i, side: 'a' },
      { kind: 'matchup', matchupIndex: (i - 1 + order.length) % order.length, side: 'b' },
    ]
  })

  state.matchupIndex = 0
  state.phase = 'writing'
  arm(state, effects, ctx.now + state.config.writingMs)
  effects.push({ kind: 'sound', cue: 'start' })
}

/** True once every answer the round is waiting on has arrived. */
export function writingComplete(state: RoomState): boolean {
  if (state.finale) return state.finale.entries.every((e) => e.submitted)
  return state.matchups.every((m) => m.a.submitted && m.b.submitted)
}

/** A pathetic line nobody has had yet this game. */
function nextFallback(state: RoomState, ctx: Ctx): string {
  const unused = ctx.fallbacks.filter((f) => !state.usedFallbacks.includes(f))
  const line = pick(state, unused.length > 0 ? unused : ctx.fallbacks) ?? '(nothing)'
  state.usedFallbacks.push(line)
  return line
}

/**
 * Nobody gets a dead matchup. Anything still blank when the clock runs out is
 * filled from `content/fallbacks.yaml` — and that answer competes for real.
 */
export function fillFallbacks(state: RoomState, ctx: Ctx): void {
  if (state.finale) {
    for (const entry of state.finale.entries) {
      if (entry.submitted) continue
      entry.text = nextFallback(state, ctx)
      entry.submitted = true
      entry.fallback = true
    }
    return
  }

  for (const matchup of state.matchups) {
    for (const side of ['a', 'b'] as const) {
      const answer = matchup[side]
      if (answer.submitted) continue
      answer.text = nextFallback(state, ctx)
      answer.submitted = true
      answer.fallback = true
    }
  }
}

export function enterVoting(state: RoomState, ctx: Ctx, effects: Effect[], index: number): void {
  state.matchupIndex = index
  state.phase = 'voting'
  arm(state, effects, ctx.now + state.config.votingMs)
}

export const currentMatchup = (state: RoomState): Matchup | undefined =>
  state.matchups[state.matchupIndex]

/** Everyone who can vote has voted, so cut the phase short after a short beat. */
export function votingComplete(state: RoomState, matchup: Matchup): boolean {
  const voters = eligibleVoters(state, matchup)
  return voters.length > 0 && voters.every((v) => matchup.votes[v.id] !== undefined)
}

export function enterReveal(state: RoomState, ctx: Ctx, effects: Effect[]): void {
  const matchup = currentMatchup(state)
  if (!matchup) {
    advanceAfterReveal(state, ctx, effects)
    return
  }

  applyReveal(state, matchup)
  state.phase = 'reveal'

  const sweep = matchup.sweep
  arm(state, effects, ctx.now + (sweep ? state.config.sweepRevealMs : state.config.revealMs))
  effects.push({ kind: 'sound', cue: sweep ? 'sweep' : 'flip' })
}

export function advanceAfterReveal(state: RoomState, ctx: Ctx, effects: Effect[]): void {
  const next = state.matchupIndex + 1
  if (next < state.matchups.length) {
    enterVoting(state, ctx, effects, next)
    return
  }
  enterScoreboard(state, ctx, effects)
}

export function enterScoreboard(state: RoomState, ctx: Ctx, effects: Effect[]): void {
  state.phase = 'scoreboard'
  arm(state, effects, ctx.now + state.config.scoreboardMs)
  effects.push({ kind: 'sound', cue: 'round-end' })
}

export function enterWinner(state: RoomState, _ctx: Ctx, effects: Effect[]): void {
  state.phase = 'winner'
  state.ended = true
  disarm(state)
  effects.push({ kind: 'sound', cue: 'winner' })
}

/**
 * Open the next round, whichever kind it is. The only place that decides
 * between a normal round and the finale, so starting a game and finishing a
 * scoreboard cannot disagree about it.
 */
export function beginNextRound(state: RoomState, ctx: Ctx, effects: Effect[]): void {
  if (state.round + 1 === state.config.finaleRound) enterFinaleWriting(state, ctx, effects)
  else enterWriting(state, ctx, effects)
}

/** After a scoreboard: another round, the finale, or the end. */
export function advanceAfterScoreboard(state: RoomState, ctx: Ctx, effects: Effect[]): void {
  const roomStillViable = writers(state).length >= state.config.minPlayers
  if (state.round >= state.config.roundCount || !roomStillViable) {
    enterWinner(state, ctx, effects)
    return
  }
  beginNextRound(state, ctx, effects)
}

export { arm, disarm, isSweep, tally }
