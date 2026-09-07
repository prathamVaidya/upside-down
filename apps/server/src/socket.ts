import { PROTOCOL_VERSION, type ServerMsg } from '@ud/protocol'
import { ClientMsgSchema } from '@ud/protocol/validate'
import type { Client, Room } from './room.ts'
import type { Rooms } from './rooms.ts'

export type Connection = {
  client: Client
  room: Room | null
}

const randomToken = () => crypto.randomUUID().replaceAll('-', '')

/**
 * The socket boundary.
 *
 * Everything arriving here is untrusted and gets validated before it becomes an
 * engine event. The reducer trusts its input completely, so this is the last
 * place that scepticism lives.
 */
export function handleMessage(conn: Connection, rooms: Rooms, raw: string): void {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    conn.client.send({ t: 'error', code: 'BAD_MESSAGE', message: 'that was not json.' })
    return
  }

  const parsed = ClientMsgSchema.safeParse(json)
  if (!parsed.success) {
    conn.client.send({
      t: 'error',
      code: 'BAD_MESSAGE',
      message: 'the game did not understand that.',
    })
    return
  }

  const msg = parsed.data

  // Entry points carry the protocol version. A stale phone left on a coffee
  // table across a deploy is the normal case, so tell it to reload rather than
  // letting it half-work.
  if ('v' in msg && msg.v !== PROTOCOL_VERSION) {
    conn.client.send({ t: 'reload', reason: 'the game updated. reload to rejoin.' })
    return
  }

  switch (msg.t) {
    case 'stage.create': {
      const room = rooms.create()
      conn.room = room
      conn.client.isStage = true
      room.add(conn.client)
      conn.client.send({
        t: 'welcome',
        v: PROTOCOL_VERSION,
        code: room.state.code,
        seatId: null,
        seatToken: null,
      })
      room.broadcast()
      return
    }

    case 'stage.attach': {
      const room = rooms.get(msg.code)
      if (!room) {
        notFound(conn.client, msg.code)
        return
      }
      conn.room = room
      conn.client.isStage = true
      room.add(conn.client)
      conn.client.send({
        t: 'welcome',
        v: PROTOCOL_VERSION,
        code: room.state.code,
        seatId: null,
        seatToken: null,
      })
      room.broadcast()
      return
    }

    case 'phone.join': {
      const room = rooms.get(msg.code)
      if (!room) {
        notFound(conn.client, msg.code)
        return
      }

      const seatId = randomToken()
      const token = randomToken()
      conn.room = room
      conn.client.seatId = seatId
      room.add(conn.client)
      room.dispatch({ type: 'seat.join', seatId, token, name: msg.name, kind: msg.kind })

      // The engine may have refused — a taken name, most likely. It has already
      // sent the reason, so just make sure we do not leave the socket bound to
      // a seat that was never created.
      const seated = room.state.seats.some((s) => s.id === seatId)
      if (!seated) {
        conn.client.seatId = null
        room.remove(conn.client)
        conn.room = null
        return
      }

      conn.client.send({
        t: 'welcome',
        v: PROTOCOL_VERSION,
        code: room.state.code,
        seatId,
        seatToken: token,
      })
      return
    }

    case 'phone.resume': {
      const room = rooms.get(msg.code)
      if (!room) {
        notFound(conn.client, msg.code)
        return
      }

      // The seat token is the identity; the socket is only ever a pipe bound to
      // it. This is what makes "you dropped, your seat is safe" true.
      const seat = room.state.seats.find((s) => s.token === msg.seatToken)
      if (!seat) {
        conn.client.send({
          t: 'error',
          code: 'SEAT_NOT_FOUND',
          message: 'that seat is gone. join again.',
        })
        return
      }

      conn.room = room
      conn.client.seatId = seat.id
      room.add(conn.client)
      room.dispatch({ type: 'seat.resume', seatId: seat.id })
      conn.client.send({
        t: 'welcome',
        v: PROTOCOL_VERSION,
        code: room.state.code,
        seatId: seat.id,
        seatToken: seat.token,
      })
      return
    }

    case 'ping':
      conn.client.send({ t: 'pong', t0: msg.t0, tServer: Date.now() })
      return

    default:
      break
  }

  // Everything below needs a seat.
  const { room, client } = conn
  if (room?.destroyed) {
    notFound(client, room.state.code)
    return
  }
  if (!room || !client.seatId) {
    client.send({ t: 'error', code: 'SEAT_NOT_FOUND', message: 'join a room first.' })
    return
  }
  const seatId = client.seatId

  switch (msg.t) {
    case 'room.destroy':
      if (room.state.hostSeatId !== seatId || client.isStage) {
        client.send({
          t: 'error',
          code: 'NOT_HOST',
          message: 'only the host can destroy this room.',
        })
        return
      }
      rooms.destroy(room)
      return
    case 'settings.set':
      room.dispatch({ type: 'settings.set', seatId, region: msg.region, level: msg.level })
      return
    case 'settings.open':
      room.dispatch({ type: 'settings.open', seatId, open: msg.open })
      return
    case 'game.start':
      room.dispatch({ type: 'game.start', seatId })
      return
    case 'answer.submit':
      room.dispatch({ type: 'answer.submit', seatId, slot: msg.slot, text: msg.text })
      return
    case 'vote.cast':
      room.dispatch({ type: 'vote.cast', seatId, side: msg.side })
      return
    case 'finale.vote':
      room.dispatch({
        type: 'finale.vote',
        seatId,
        entrySeatId: msg.entrySeatId,
        delta: msg.delta,
      })
      return
  }
}

function notFound(client: Client, code: string): void {
  const message: ServerMsg = {
    t: 'error',
    code: 'ROOM_NOT_FOUND',
    message: `${code} isn't a room. check the code and retype it.`,
  }
  client.send(message)
}
