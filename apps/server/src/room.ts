import type { Ctx, Effect, EngineConfig, Event, RoomState } from '@ud/engine'
import { createRoom, DEFAULT_CONFIG, project, reduce } from '@ud/engine'
import { ctxAt } from '@ud/engine/bootstrap'
import type { RoomCode, SeatId, ServerMsg } from '@ud/protocol'

/** Anything that can receive messages. Abstracted so tests need no sockets. */
export type Client = {
  /** Null until the client identifies — the stage never gets one. */
  seatId: SeatId | null
  isStage: boolean
  send: (msg: ServerMsg) => void
}

/**
 * One live room: the pure state, the sockets attached to it, and the single
 * timer that owns its current deadline.
 *
 * Everything interesting happens in `@ud/engine`. This class only carries out
 * the effects the reducer asks for, which is why it is short and why the game
 * rules are testable without it.
 */
export class Room {
  state: RoomState
  clients = new Set<Client>()
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private seq = 0
  lastActivityAt: number

  constructor(code: RoomCode, config: EngineConfig = DEFAULT_CONFIG) {
    const now = Date.now()
    this.state = createRoom(code, now, (Math.random() * 2 ** 31) | 0, config)
    this.lastActivityAt = now
  }

  private ctx(): Ctx {
    return ctxAt(Date.now())
  }

  dispatch(event: Event): void {
    const { state, effects } = reduce(this.state, event, this.ctx())
    this.state = state
    this.lastActivityAt = Date.now()
    this.run(effects)
  }

  private run(effects: Effect[]): void {
    for (const effect of effects) {
      switch (effect.kind) {
        case 'schedule':
          this.schedule(effect.at, effect.event)
          break
        case 'broadcast':
          this.broadcast()
          break
        case 'sound':
          // Stage only — phones stay silent, they are remote controls.
          for (const c of this.clients) if (c.isStage) c.send({ t: 'sound', cue: effect.cue })
          break
        case 'reject':
          for (const c of this.clients) {
            if (c.seatId === effect.seatId) {
              c.send({ t: 'error', code: effect.code, message: effect.message })
            }
          }
          break
      }
    }
  }

  private schedule(at: number, event: Event): void {
    const delay = Math.max(0, at - Date.now())
    const handle = setTimeout(() => {
      this.timers.delete(handle)
      this.dispatch(event)
    }, delay)
    this.timers.add(handle)
  }

  /**
   * One projection per recipient.
   *
   * Deliberately not `server.publish()`: Bun's pub/sub sends one identical
   * payload to a topic, and identical payloads are exactly what this game
   * cannot have — the two authors of a matchup must not receive what the
   * voters receive. Viewers do collapse into a few equivalence classes per
   * phase (stage, voter, author A, author B), so this loop can be memoised by
   * class if a room ever gets big enough to care. At eight players it is free.
   */
  broadcast(): void {
    const now = Date.now()
    this.seq++
    for (const client of this.clients) {
      client.send({ t: 'view', seq: this.seq, view: project(this.state, client.seatId, now) })
    }
  }

  add(client: Client): void {
    this.clients.add(client)
  }

  remove(client: Client): void {
    this.clients.delete(client)
    if (client.seatId) this.dispatch({ type: 'seat.disconnect', seatId: client.seatId })
  }

  get isEmpty(): boolean {
    return this.clients.size === 0
  }

  destroy(): void {
    for (const t of this.timers) clearTimeout(t)
    this.timers.clear()
    this.clients.clear()
  }
}
