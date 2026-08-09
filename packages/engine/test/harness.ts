/**
 * A whole game with no sockets, no clock and no network.
 *
 * The reducer is pure, so "play a game" is just folding events over state with
 * a fake clock. Every test below runs in well under a millisecond, which is the
 * entire reason the engine was built this way.
 */
import type { SeatId } from '@ud/protocol'
import { DEFAULT_CONFIG, type EngineConfig } from '../src/config.ts'
import type { Ctx } from '../src/ctx.ts'
import type { LibraryPrompt } from '../src/deck.ts'
import type { Effect, Event } from '../src/events.ts'
import { reduce } from '../src/reduce.ts'
import { createRoom, type RoomState } from '../src/state.ts'

export const LIBRARY: LibraryPrompt[] = Array.from({ length: 40 }, (_, i) => ({
  id: `t-${String(i).padStart(3, '0')}`,
  region: 'global' as const,
  level: 1 as const,
  text: `Test prompt number ${i}`,
}))

export const FALLBACKS = ['(said nothing)', '(was still typing)', '(gave up early)', '(blank)']

export class Game {
  state: RoomState
  now = 1_000_000
  /** Scheduled events waiting to fire, as the server's timers would hold them. */
  timers: { at: number; event: Event }[] = []
  sounds: string[] = []
  rejects: { seatId: SeatId; code: string; message: string }[] = []

  constructor(config: Partial<EngineConfig> = {}, seed = 42) {
    this.state = createRoom('TEST', this.now, seed, { ...DEFAULT_CONFIG, ...config })
  }

  private ctx(): Ctx {
    return { now: this.now, library: LIBRARY, fallbacks: FALLBACKS }
  }

  dispatch(event: Event): this {
    const { state, effects } = reduce(this.state, event, this.ctx())
    this.state = state
    this.absorb(effects)
    return this
  }

  private absorb(effects: Effect[]): void {
    for (const e of effects) {
      if (e.kind === 'schedule') this.timers.push({ at: e.at, event: e.event })
      if (e.kind === 'sound') this.sounds.push(e.cue)
      if (e.kind === 'reject') {
        this.rejects.push({ seatId: e.seatId, code: e.code, message: e.message })
      }
    }
  }

  /** Jump to the next scheduled event and fire it, as a real timer would. */
  tick(): this {
    const next = this.timers.sort((a, b) => a.at - b.at).shift()
    if (!next) throw new Error('nothing scheduled — the game is stuck')
    this.now = Math.max(this.now, next.at)
    return this.dispatch(next.event)
  }

  /** Fire timers until the phase changes, so tests can say "let the clock run". */
  runUntilPhaseChanges(): this {
    const from = this.state.phase
    let guard = 0
    while (this.state.phase === from) {
      if (guard++ > 50) throw new Error(`stuck in ${from}`)
      this.tick()
    }
    return this
  }

  /** Fire only the pending host-grace timer, leaving phase clocks alone. */
  runUntilHostCheck(): this {
    const idx = this.timers.findIndex((t) => t.event.type === 'host.check')
    if (idx === -1) throw new Error('no host check scheduled')
    const [next] = this.timers.splice(idx, 1)
    this.now = Math.max(this.now, next!.at)
    return this.dispatch(next!.event)
  }

  join(name: string, kind: 'player' | 'audience' = 'player'): SeatId {
    const seatId = `seat-${name.toLowerCase()}`
    this.dispatch({ type: 'seat.join', seatId, token: `tok-${seatId}`, name, kind })
    return seatId
  }

  get host(): SeatId {
    if (!this.state.hostSeatId) throw new Error('no host')
    return this.state.hostSeatId
  }

  /** Everyone writes something identifiable, so leaks are easy to assert on. */
  everyoneWrites(): this {
    for (const [seatId, list] of Object.entries(this.state.assignments)) {
      for (let slot = 0; slot < list.length; slot++) {
        if (this.state.phase !== 'writing') return this
        this.dispatch({ type: 'answer.submit', seatId, slot, text: `answer-by-${seatId}-${slot}` })
      }
    }
    return this
  }

  /** Every eligible voter backs `side`, producing a sweep. */
  everyoneVotes(side: 'a' | 'b' | 'split' = 'a'): this {
    const matchup = this.state.matchups[this.state.matchupIndex]
    if (!matchup) throw new Error('no matchup')
    const voters = this.state.seats.filter(
      (s) => s.connected && s.id !== matchup.a.seatId && s.id !== matchup.b.seatId,
    )
    voters.forEach((v, i) => {
      const chosen = side === 'split' ? (i % 2 === 0 ? 'a' : 'b') : side
      this.dispatch({ type: 'vote.cast', seatId: v.id, side: chosen })
    })
    return this
  }
}

/** Lobby with `n` players, host is the first. */
export function lobbyOf(n: number, config: Partial<EngineConfig> = {}): Game {
  const g = new Game(config)
  const names = ['Priya', 'Tom', 'Ansh', 'Lena', 'Mo', 'Kit', 'Rae', 'Sol']
  for (let i = 0; i < n; i++) g.join(names[i]!)
  return g
}
