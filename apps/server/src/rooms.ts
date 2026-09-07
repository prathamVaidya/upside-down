import type { EngineConfig } from '@ud/engine'
import { codeWords } from '@ud/engine/bootstrap'
import type { RoomCode } from '@ud/protocol'
import { configFromEnv } from './config.ts'
import { Room } from './room.ts'

/** Ten minutes after the last person leaves, or two hours flat. */
const IDLE_TTL_MS = 10 * 60 * 1000
const ABSOLUTE_TTL_MS = 2 * 60 * 60 * 1000
const SWEEP_INTERVAL_MS = 60 * 1000

/**
 * The room registry.
 *
 * In memory, dies with the process, and that is the whole persistence story.
 * There are no accounts and no PII here, so there is nothing to protect and
 * nothing to migrate — a room is a fifteen-minute conversation, not a record.
 */
export class Rooms {
  private byCode = new Map<RoomCode, Room>()
  private words = codeWords()
  private sweeper: ReturnType<typeof setInterval> | null = null

  create(config: EngineConfig = configFromEnv()): Room {
    const room = new Room(this.allocateCode(), config)
    this.byCode.set(room.state.code, room)
    return room
  }

  get(code: string): Room | undefined {
    return this.byCode.get(code.toUpperCase())
  }

  destroy(room: Room): void {
    if (this.byCode.get(room.state.code) !== room) return
    this.byCode.delete(room.state.code)
    room.destroy('The host destroyed this room. Everyone has been disconnected.')
  }

  /**
   * Four-letter dictionary words: easier to read across a room and to retype
   * than random letters, and they let the idle screen make a joke about the B.
   * Falls back to random strings once the pool is crowded so allocation cannot
   * spin.
   */
  private allocateCode(): RoomCode {
    const free = this.words.filter((w) => !this.byCode.has(w))
    if (free.length > this.words.length / 2) {
      return free[Math.floor(Math.random() * free.length)]!
    }
    let code: string
    do {
      code = Array.from({ length: 4 }, () =>
        String.fromCharCode(65 + Math.floor(Math.random() * 26)),
      ).join('')
    } while (this.byCode.has(code))
    return code
  }

  startSweeper(): void {
    if (this.sweeper) return
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS)
    // Never hold the process open just to reap empty rooms.
    this.sweeper.unref?.()
  }

  sweep(now = Date.now()): number {
    let reaped = 0
    for (const [code, room] of this.byCode) {
      const idle = room.isEmpty && now - room.lastActivityAt > IDLE_TTL_MS
      const ancient = now - room.state.createdAt > ABSOLUTE_TTL_MS
      if (idle || ancient) {
        room.destroy()
        this.byCode.delete(code)
        reaped++
      }
    }
    return reaped
  }

  get size(): number {
    return this.byCode.size
  }

  /** Rooms with at least one connected phone or stage, excluding idle retained rooms. */
  get activeRoomCount(): number {
    let count = 0
    for (const room of this.byCode.values()) if (!room.isEmpty) count++
    return count
  }
}
