import type { Ctx } from './ctx.ts'
import { drawPrompts } from './deck.ts'
import type { Effect } from './events.ts'
import { chooseOrder, cyclePairs } from './pairing.ts'
import { pick } from './rng.ts'
import { applyReveal, isSweep, tally } from './scoring.ts'
import type { Matchup, RoomState } from './state.ts'
import { eligibleVoters, pairKey, writers } from './state.ts'

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

export function enterWriting(state: RoomState, ctx: Ctx, effects: Effect[]): void {
  state.round++
  for (const s of state.seats) {
    s.delta = 0
    s.lostLast = false
  }

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
      { matchupIndex: i, side: 'a' },
      { matchupIndex: (i - 1 + order.length) % order.length, side: 'b' },
    ]
  })

  state.matchupIndex = 0
  state.phase = 'writing'
  arm(state, effects, ctx.now + state.config.writingMs)
  effects.push({ kind: 'sound', cue: 'start' })
}

/** True once every side of every matchup has an answer in it. */
export function writingComplete(state: RoomState): boolean {
  return state.matchups.every((m) => m.a.submitted && m.b.submitted)
}

/**
 * Nobody gets a dead matchup. Anything still blank when the clock runs out is
 * filled from `content/fallbacks.yaml` — and that answer competes for real.
 */
export function fillFallbacks(state: RoomState, ctx: Ctx): void {
  for (const matchup of state.matchups) {
    for (const side of ['a', 'b'] as const) {
      const answer = matchup[side]
      if (answer.submitted) continue
      const unused = ctx.fallbacks.filter((f) => !state.usedFallbacks.includes(f))
      const line = pick(state, unused.length > 0 ? unused : ctx.fallbacks) ?? '(nothing)'
      state.usedFallbacks.push(line)
      answer.text = line
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

/** After a scoreboard: another round, or the end. */
export function advanceAfterScoreboard(state: RoomState, ctx: Ctx, effects: Effect[]): void {
  if (state.round < state.config.roundCount && writers(state).length >= state.config.minPlayers) {
    enterWriting(state, ctx, effects)
  } else {
    enterWinner(state, ctx, effects)
  }
}

export { arm, disarm, isSweep, tally }
