/**
 * Collect one `ClientView` per phase of a real game, for whoever needs to
 * render them.
 *
 * The client tests use this so their fixtures are never hand-written: every
 * screen is exercised against state the engine actually produced, which means a
 * change to the projection breaks the screens that depend on it instead of
 * silently drifting from them.
 */
import type { ClientView, SeatId } from '@ud/protocol'
import { DEFAULT_CONFIG } from '../src/config.ts'
import type { Ctx } from '../src/ctx.ts'
import type { Event } from '../src/events.ts'
import { project } from '../src/project.ts'
import { reduce } from '../src/reduce.ts'
import { createRoom, type RoomState } from '../src/state.ts'
import { FALLBACKS, LIBRARY } from './harness.ts'

export type PhaseSample = {
  phase: string
  /** As the television sees it. */
  stage: ClientView
  /** As each seat sees it — different people, genuinely different payloads. */
  seats: { seatId: SeatId; view: ClientView }[]
}

/**
 * Play a whole game, sampling every phase exactly once.
 *
 * `finale` swaps the single head-to-head round for a finale, so the same driver
 * produces fixtures for both shapes of round without the screens having to
 * agree on hand-written state.
 */
export function samplePhases(playerCount = 4, finale = false): PhaseSample[] {
  let now = 1_000_000
  let state: RoomState = createRoom('MINT', now, 4242, {
    ...DEFAULT_CONFIG,
    roundCount: 1,
    finaleRound: finale ? 1 : null,
  })
  const timers: { at: number; event: Event }[] = []
  const samples: PhaseSample[] = []
  const seen = new Set<string>()

  const ctx = (): Ctx => ({ now, library: LIBRARY, fallbacks: FALLBACKS })

  const dispatch = (event: Event) => {
    const out = reduce(state, event, ctx())
    state = out.state
    for (const e of out.effects)
      if (e.kind === 'schedule') timers.push({ at: e.at, event: e.event })
  }

  /**
   * Sampling is explicit rather than automatic, because *when* in a phase you
   * look changes what the screens get. The lobby is only interesting once
   * everybody has arrived; the writing phase is only interesting before anyone
   * has submitted. Capturing on every dispatch would give the opposite of both.
   */
  const capture = () => {
    if (seen.has(state.phase)) return
    seen.add(state.phase)
    samples.push({
      phase: state.phase,
      stage: project(state, null, now),
      seats: state.seats.map((s) => ({ seatId: s.id, view: project(state, s.id, now) })),
    })
  }

  const names = ['Priya', 'Tom', 'Ansh', 'Lena', 'Mo', 'Kit', 'Rae', 'Sol']
  for (let i = 0; i < playerCount; i++) {
    const seatId = `seat-${i}`
    dispatch({ type: 'seat.join', seatId, token: `tok-${i}`, name: names[i]!, kind: 'player' })
  }

  // A full lobby, which is the only version of it worth rendering.
  capture()

  dispatch({ type: 'game.start', seatId: state.hostSeatId! })
  // Writing, with everyone's prompt still live and nothing submitted.
  capture()

  // Then write everything, and play every matchup to a sweep so the reveal
  // sample carries the celebratory case rather than a boring split.
  for (const [seatId, list] of Object.entries(state.assignments)) {
    for (let slot = 0; slot < list.length; slot++) {
      if (state.phase !== 'writing') break
      dispatch({ type: 'answer.submit', seatId, slot, text: `${seatId} wrote thing ${slot}` })
    }
  }

  let guard = 0
  while (state.phase !== 'winner') {
    if (guard++ > 300) throw new Error('game never ended')
    capture()

    if (state.phase === 'voting') {
      const m = state.matchups[state.matchupIndex]!
      for (const s of state.seats) {
        if (s.id !== m.a.seatId && s.id !== m.b.seatId) {
          dispatch({ type: 'vote.cast', seatId: s.id, side: 'a' })
        }
      }
    }

    if (state.phase === 'finaleVoting') {
      // Concentrate the votes on the first few answers.
      //
      // Round-robin looks fairer but at eight voters with three votes each it
      // lands on a perfect eight-way tie, and a fixture where nobody loses
      // cannot exercise the losing half of the reveal.
      const entries = state.finale!.entries
      for (const [i, voter] of state.seats.entries()) {
        const targets = entries.filter((e) => e.seatId !== voter.id)
        const target = targets[i % Math.min(3, targets.length)]
        if (!target) continue
        for (let v = 0; v < state.config.votesPerFinaleVoter; v++) {
          dispatch({ type: 'finale.vote', seatId: voter.id, entrySeatId: target.seatId, delta: 1 })
        }
      }
    }

    const next = timers.sort((a, b) => a.at - b.at).shift()
    if (!next) throw new Error('nothing scheduled')
    now = Math.max(now, next.at)
    dispatch(next.event)
  }

  capture()
  return samples
}
