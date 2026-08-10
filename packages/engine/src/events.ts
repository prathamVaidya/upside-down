import type {
  ContentLevel,
  ErrorCode,
  Region,
  SeatId,
  SeatToken,
  Side,
  SoundCue,
} from '@ud/protocol'

/**
 * Everything that can happen to a room.
 *
 * Ids and tokens are minted by the server and arrive here as data — the engine
 * never generates them, because generating them would mean calling something
 * non-deterministic and the whole design rests on this file being replayable.
 */
export type Event =
  | {
      type: 'seat.join'
      seatId: SeatId
      token: SeatToken
      name: string
      kind: 'player' | 'audience'
    }
  | { type: 'seat.resume'; seatId: SeatId }
  | { type: 'seat.disconnect'; seatId: SeatId }
  | { type: 'settings.set'; seatId: SeatId; region: Region; level: ContentLevel }
  | { type: 'settings.open'; seatId: SeatId; open: boolean }
  | { type: 'game.start'; seatId: SeatId }
  | { type: 'answer.submit'; seatId: SeatId; slot: number; text: string }
  | { type: 'vote.cast'; seatId: SeatId; side: Side }
  /**
   * One step of a finale ballot. Votes go on and come off until the clock
   * stops, because mockup 2l gives each row a minus as well as a plus — the
   * "no takebacks" rule belongs to the head-to-head round, not this one.
   */
  | { type: 'finale.vote'; seatId: SeatId; entrySeatId: SeatId; delta: 1 | -1 }
  /** A phase clock ran out. `token` is checked against `state.timerToken`. */
  | { type: 'deadline'; token: number }
  /** Fires `hostGraceMs` after a host drops; a no-op if they came back. */
  | { type: 'host.check'; seatId: SeatId }

/**
 * What the server must do as a result. The engine describes; the adapter acts.
 * Nothing in here performs I/O, which is what keeps `reduce` testable.
 */
export type Effect =
  | { kind: 'schedule'; at: number; event: Event }
  | { kind: 'broadcast' }
  | { kind: 'sound'; cue: SoundCue }
  | { kind: 'reject'; seatId: SeatId; code: ErrorCode; message: string }
