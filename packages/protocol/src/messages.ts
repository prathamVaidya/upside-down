import type { ContentLevel, Region, RoomCode, SeatId, SeatToken, Side } from './ids.ts'
import type { ClientView } from './view.ts'

export const NAME_MAX = 12
export const ANSWER_MAX = 100
export const CODE_LENGTH = 4

/**
 * Everything a client may send.
 *
 * Types only. The zod schemas that actually validate these live in
 * `@ud/protocol/validate`, which the server imports and the clients do not —
 * a phone has no reason to carry a copy of the server's validator, and at a
 * party over mobile data those kilobytes are the difference between joining
 * and giving up.
 */
export type ClientMsg =
  /** The TV asks for a fresh room. */
  | { t: 'stage.create'; v: number }
  /** The TV reconnects to a room that already exists. */
  | { t: 'stage.attach'; v: number; code: RoomCode }
  | { t: 'phone.join'; v: number; code: RoomCode; name: string; kind: 'player' | 'audience' }
  | { t: 'phone.resume'; v: number; code: RoomCode; seatToken: SeatToken }
  | { t: 'settings.set'; region: Region; level: ContentLevel }
  | { t: 'settings.open'; open: boolean }
  | { t: 'game.start' }
  | { t: 'room.destroy' }
  /**
   * `slot` indexes the player's own two assignments. The phone never learns a
   * matchup index or which side it is writing for — that mapping stays server
   * side, so a curious player cannot work out who they are up against.
   */
  | { t: 'answer.submit'; slot: number; text: string }
  | { t: 'vote.cast'; side: Side }
  /**
   * One step of a finale ballot. `entrySeatId` is the entry's id from
   * `FinaleEntryView`, which the server only reveals as an author later.
   */
  | { t: 'finale.vote'; entrySeatId: SeatId; delta: 1 | -1 }
  | { t: 'ping'; t0: number }

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NAME_TAKEN'
  | 'GAME_IN_PROGRESS'
  | 'NOT_HOST'
  | 'BAD_MESSAGE'
  | 'SEAT_NOT_FOUND'

export type SoundCue =
  | 'join'
  | 'start'
  | 'submit'
  | 'vote-land'
  | 'flip'
  | 'sweep'
  | 'round-end'
  | 'winner'

/** Everything the server sends. Clients trust the server, so no schema here. */
export type ServerMsg =
  | { t: 'room.closed'; reason: string }
  | { t: 'welcome'; v: number; code: RoomCode; seatId: SeatId | null; seatToken: SeatToken | null }
  | { t: 'view'; seq: number; view: ClientView }
  | { t: 'pong'; t0: number; tServer: number }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'reload'; reason: string }
  | { t: 'sound'; cue: SoundCue }
