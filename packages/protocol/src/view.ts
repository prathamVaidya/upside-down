import type { ColorRole, ContentLevel, Region, RoomCode, SeatId, ShapeId, Side } from './ids.ts'

/**
 * What a single connected client is allowed to see, right now.
 *
 * This is the ONLY shape that crosses the wire to a client. `RoomState` never
 * does. Everything a viewer must not know — authorship before reveal, other
 * players' un-submitted answers — is absent here by construction rather than
 * hidden by the UI. See `project()` in @ud/engine.
 */
export type ClientView = {
  code: RoomCode
  /** Server clock at send time; clients correct their countdown against it. */
  serverNow: number
  /** Epoch ms, never a remaining-seconds count. Null when nothing is running. */
  phaseEndsAt: number | null
  round: number
  roundCount: number
  /** The viewer's own seat. Null for the stage, which has no seat. */
  you: SeatView | null
  seats: SeatView[]
  phase: PhaseView
}

export type SeatView = {
  id: SeatId
  name: string
  color: ColorRole
  shape: ShapeId
  kind: 'player' | 'audience'
  connected: boolean
  isHost: boolean
  score: number
  /** Points gained in the round just scored, for the scoreboard delta. */
  delta: number
}

export type Settings = {
  region: Region
  level: ContentLevel
}

export type PhaseView =
  | LobbyView
  | WritingView
  | VotingView
  | RevealView
  | ScoreboardView
  | FinaleVotingView
  | FinaleRevealView
  | WinnerView

export type LobbyView = {
  name: 'lobby'
  settings: Settings
  /** Host has the region picker open — the stage mirrors it live (mockup 2a). */
  settingsOpen: boolean
  playerCount: number
  minPlayers: number
  maxPlayers: number
  canStart: boolean
}

export type WritingView = {
  name: 'writing'
  /** The finale deals one prompt to everybody instead of two each. */
  isFinale: boolean
  /**
   * The prompt this viewer is currently on. Null once they've finished both, or
   * always null for the stage and the audience. Nobody ever receives another
   * player's prompt.
   */
  assignment: { slot: number; of: number; promptText: string } | null
  /** Per-player progress for the stage's flip tiles (mockup 2b). */
  progress: { seatId: SeatId; done: number; of: number }[]
  submittedCount: number
  writerCount: number
}

export type VotingView = {
  name: 'voting'
  matchupNumber: number
  matchupCount: number
  promptText: string
  /** No author fields. That is the whole point. */
  a: { text: string; votes: number }
  b: { text: string; votes: number }
  /** Set only for the two authors, who sit this one out (mockup 2k). */
  yourSide: Side | null
  youMayVote: boolean
  yourVote: Side | null
  votesIn: number
  votersExpected: number
}

export type RevealView = {
  name: 'reveal'
  matchupNumber: number
  matchupCount: number
  promptText: string
  a: RevealSide
  b: RevealSide
  winner: Side | 'tie'
  /** Every eligible vote went one way — the room's biggest beat (mockup 1f). */
  sweep: boolean
}

export type RevealSide = {
  text: string
  votes: number
  points: number
  authorSeatId: SeatId
  authorName: string
  /** Auto-filled because they submitted nothing. It can still win (mockup 2n). */
  fallback: boolean
}

/**
 * The finale ballot: one prompt, every answer on screen at once, and three
 * votes to spread across them however you like.
 *
 * The hardest layout in the game — it has to stay readable at eight answers on
 * a television and be operable one-handed on a phone.
 */
export type FinaleVotingView = {
  name: 'finaleVoting'
  promptText: string
  /** No authors. Anonymous until the reveal, exactly like a matchup. */
  entries: FinaleEntryView[]
  votesPerVoter: number
  /** How many the viewer has left to spend. Zero for the stage. */
  votesLeft: number
  votesIn: number
  votesPossible: number
}

export type FinaleEntryView = {
  /** Identifies the entry for voting. Not revealed as its author until later. */
  id: SeatId
  text: string
  votes: number
  /** Set for the viewer's own answer, which is kept off their ballot. */
  isYours: boolean
  /** How many of the viewer's own votes are sitting on this one. */
  yourVotes: number
}

export type FinaleRevealView = {
  name: 'finaleReveal'
  promptText: string
  entries: FinaleRevealEntry[]
  winnerSeatId: SeatId | null
  sweep: boolean
}

export type FinaleRevealEntry = {
  seatId: SeatId
  authorName: string
  color: ColorRole
  shape: ShapeId
  text: string
  votes: number
  points: number
  fallback: boolean
  won: boolean
}

export type ScoreboardView = {
  name: 'scoreboard'
  roundJustEnded: number
  nextRound: number | null
  rows: ScoreRow[]
}

export type ScoreRow = {
  seatId: SeatId
  name: string
  color: ColorRole
  shape: ShapeId
  score: number
  delta: number
  /** Lost their last matchup, so they spend the break upside down. */
  upsideDown: boolean
}

export type WinnerView = {
  name: 'winner'
  championSeatId: SeatId
  championName: string
  championScore: number
  championSweeps: number
  rows: ScoreRow[]
}
