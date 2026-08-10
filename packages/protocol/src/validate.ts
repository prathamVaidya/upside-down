import { z } from 'zod'
import { ANSWER_MAX, type ClientMsg, NAME_MAX } from './messages.ts'

/**
 * The socket boundary's scepticism, kept in its own module so it stays on the
 * server. Importing this from a client would ship the whole validator to a
 * phone for no benefit — nothing a client sends to itself needs checking.
 */

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}$/, 'room codes are four letters')

const name = z.string().trim().min(1).max(NAME_MAX)
const side = z.enum(['a', 'b'])

export const ClientMsgSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('stage.create'), v: z.number().int() }),
  z.object({ t: z.literal('stage.attach'), v: z.number().int(), code }),
  z.object({
    t: z.literal('phone.join'),
    v: z.number().int(),
    code,
    name,
    kind: z.enum(['player', 'audience']).default('player'),
  }),
  z.object({
    t: z.literal('phone.resume'),
    v: z.number().int(),
    code,
    seatToken: z.string().min(8).max(64),
  }),
  z.object({
    t: z.literal('settings.set'),
    region: z.enum(['global', 'in', 'uk', 'us']),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  z.object({ t: z.literal('settings.open'), open: z.boolean() }),
  z.object({ t: z.literal('game.start') }),
  z.object({
    t: z.literal('answer.submit'),
    slot: z.number().int().min(0).max(1),
    text: z.string().max(ANSWER_MAX),
  }),
  z.object({ t: z.literal('vote.cast'), side }),
  z.object({
    t: z.literal('finale.vote'),
    entrySeatId: z.string().min(8).max(64),
    delta: z.union([z.literal(1), z.literal(-1)]),
  }),
  z.object({ t: z.literal('ping'), t0: z.number() }),
])

/**
 * Compile-time proof that the validator and the hand-written type agree. If
 * somebody adds a message to one and forgets the other, this stops building.
 */
type SchemaMatchesType = z.infer<typeof ClientMsgSchema> extends ClientMsg ? true : never
const _typesAgree: SchemaMatchesType = true
void _typesAgree
