import type {
  ColorRole,
  ContentLevel,
  Region,
  RoomCode,
  SeatId,
  SeatToken,
  ShapeId,
  Side,
} from '@ud/protocol'
import { COLOR_ROLES, SHAPE_IDS } from '@ud/protocol'
import type { EngineConfig } from './config.ts'
import { DEFAULT_CONFIG } from './config.ts'

export type Phase =
  | 'lobby'
  | 'writing'
  | 'voting'
  | 'reveal'
  | 'scoreboard'
  | 'finaleVoting'
  | 'finaleReveal'
  | 'winner'

export type Seat = {
  id: SeatId
  token: SeatToken
  name: string
  kind: 'player' | 'audience'
  color: ColorRole
  shape: ShapeId
  connected: boolean
  joinedAt: number
  score: number
  /** Points gained this round, reset when a round starts. */
  delta: number
  sweeps: number
  /** Lost their most recent matchup, so they hang upside down on the break. */
  lostLast: boolean
}

export type Answer = {
  seatId: SeatId
  text: string
  submitted: boolean
  /** Auto-filled because they wrote nothing. It can still win (mockup 2n). */
  fallback: boolean
}

export type Matchup = {
  promptId: string
  promptText: string
  a: Answer
  b: Answer
  votes: Record<SeatId, Side>
  points: { a: number; b: number }
  sweep: boolean
  revealed: boolean
}

/**
 * Where one of a player's prompts lives.
 *
 * Normal rounds put each writer on two edges of the matchup cycle. The finale
 * gives everybody the same single prompt, so it needs no coordinates — but it
 * still travels through the same `assignments` map, which is what lets the
 * phone's writing screen stay identical in both.
 */
export type Assignment = { kind: 'matchup'; matchupIndex: number; side: Side } | { kind: 'finale' }

/** One player's answer to the finale prompt. */
export type FinaleEntry = {
  seatId: SeatId
  text: string
  submitted: boolean
  fallback: boolean
  points: number
}

export type Finale = {
  promptId: string
  promptText: string
  entries: FinaleEntry[]
  /** voter → (entry author → how many of their votes landed there). */
  votes: Record<SeatId, Record<SeatId, number>>
  sweptBy: SeatId | null
}

export type RoomState = {
  code: RoomCode
  createdAt: number
  config: EngineConfig

  phase: Phase
  /** Epoch ms. Null when nothing is on a clock. */
  phaseEndsAt: number | null
  /**
   * Guards against a stale `setTimeout` advancing a phase it no longer owns —
   * every scheduled deadline carries the token that was current when it was
   * set, and a mismatch is dropped on the floor.
   */
  timerToken: number

  settings: { region: Region; level: ContentLevel }
  /** Host has the picker open; the stage mirrors it live (mockup 2a). */
  settingsOpen: boolean

  seats: Seat[]
  hostSeatId: SeatId | null

  round: number
  matchups: Matchup[]
  matchupIndex: number
  assignments: Record<SeatId, Assignment[]>
  /** Set when the finale round starts; null for every normal round. */
  finale: Finale | null

  /** Prompt ids already spent this game, so a round never repeats one. */
  usedPromptIds: string[]
  /** Pairs already played, as "idA|idB" sorted, to bias against repeats. */
  pastPairs: string[]
  /** Fallback lines already used, so the same one does not appear twice. */
  usedFallbacks: string[]

  seed: number
  ended: boolean
}

export function createRoom(
  code: RoomCode,
  now: number,
  seed: number,
  config: EngineConfig = DEFAULT_CONFIG,
): RoomState {
  return {
    code,
    createdAt: now,
    config,
    phase: 'lobby',
    phaseEndsAt: null,
    timerToken: 0,
    settings: { region: 'global', level: 2 },
    settingsOpen: false,
    seats: [],
    hostSeatId: null,
    round: 0,
    matchups: [],
    matchupIndex: 0,
    assignments: {},
    finale: null,
    usedPromptIds: [],
    pastPairs: [],
    usedFallbacks: [],
    seed,
    ended: false,
  }
}

export const seat = (state: RoomState, id: SeatId | null): Seat | undefined =>
  id === null ? undefined : state.seats.find((s) => s.id === id)

export const players = (state: RoomState): Seat[] => state.seats.filter((s) => s.kind === 'player')

/** Players who will be dealt prompts — connected ones only. */
export const writers = (state: RoomState): Seat[] =>
  state.seats.filter((s) => s.kind === 'player' && s.connected)

export const isHost = (state: RoomState, id: SeatId): boolean => state.hostSeatId === id

/**
 * Four palette colours across up to eight players, so the silhouette carries the
 * rest. That also satisfies the accessibility floor's "no meaning by colour
 * alone" — see open question 1 in ARCHITECTURE.md.
 */
export function identityFor(index: number): { color: ColorRole; shape: ShapeId } {
  return {
    color: COLOR_ROLES[index % COLOR_ROLES.length]!,
    shape: SHAPE_IDS[Math.floor(index / COLOR_ROLES.length) % SHAPE_IDS.length]!,
  }
}

export const pairKey = (a: SeatId, b: SeatId): string => [a, b].sort().join('|')

/**
 * Everyone entitled to vote on a matchup: every connected seat, players and
 * audience alike, except the two people who wrote the answers.
 */
export function eligibleVoters(state: RoomState, matchup: Matchup): Seat[] {
  return state.seats.filter(
    (s) => s.connected && s.id !== matchup.a.seatId && s.id !== matchup.b.seatId,
  )
}

/**
 * Everyone entitled to vote in the finale: every connected seat. Authors are
 * not excluded here the way they are in a matchup — they simply cannot spend
 * votes on themselves, which the reducer enforces per vote.
 */
export function finaleVoters(state: RoomState): Seat[] {
  return state.seats.filter((s) => s.connected)
}

/** How many of their finale votes this seat has already spent. */
export function votesSpent(finale: Finale, seatId: SeatId): number {
  return Object.values(finale.votes[seatId] ?? {}).reduce((sum, n) => sum + n, 0)
}
