/** Identifier aliases. Plain strings — documentation, not enforcement. */
export type SeatId = string
export type RoomCode = string
export type PromptId = string
export type SeatToken = string

/** Index into `RoomState.matchups`. */
export type MatchupIndex = number

/** Which of the two answers in a matchup. */
export type Side = 'a' | 'b'

/**
 * Palette roles from direction sheet 1a. Four colours for up to eight players,
 * so `ShapeId` carries the rest of the identity — see open question 1 in
 * ARCHITECTURE.md, and the accessibility floor's "no meaning by colour alone".
 */
export const COLOR_ROLES = ['brick', 'slate', 'butter', 'sage'] as const
export type ColorRole = (typeof COLOR_ROLES)[number]

/** Second identity dimension: the silhouette a seat's clay blob is cut to. */
export const SHAPE_IDS = ['pebble', 'lump'] as const
export type ShapeId = (typeof SHAPE_IDS)[number]

export const REGIONS = ['global', 'in', 'uk', 'us'] as const
export type Region = (typeof REGIONS)[number]

/** 1 HR approved · 2 medium roast · 3 Burn in Hell */
export type ContentLevel = 1 | 2 | 3
