import { PROTOCOL_VERSION, type ServerMsg } from '@ud/protocol'
import { afterEach, expect, it, vi } from 'vitest'
import { Rooms } from '../src/rooms.ts'
import { type Connection, handleMessage } from '../src/socket.ts'

afterEach(() => vi.useRealTimers())

it('only the host can destroy a room, notifying everyone and stopping future activity', () => {
  vi.useFakeTimers()
  const rooms = new Rooms()
  const room = rooms.create()
  const connect = (name?: string) => {
    const messages: ServerMsg[] = []
    const conn: Connection = {
      room: null,
      client: { seatId: null, isStage: false, send: (msg) => messages.push(msg) },
    }
    handleMessage(
      conn,
      rooms,
      JSON.stringify(
        name
          ? { t: 'phone.join', v: PROTOCOL_VERSION, code: room.state.code, name, kind: 'player' }
          : { t: 'stage.attach', v: PROTOCOL_VERSION, code: room.state.code },
      ),
    )
    return { conn, messages }
  }
  const host = connect('Host')
  const guest = connect('Guest')
  const third = connect('Third')
  const stage = connect()
  const send = (conn: Connection, t: string) => handleMessage(conn, rooms, JSON.stringify({ t }))
  send(guest.conn, 'room.destroy')
  expect(guest.messages.at(-1)).toMatchObject({ t: 'error', code: 'NOT_HOST' })
  send(stage.conn, 'room.destroy')
  expect(stage.messages.at(-1)).toMatchObject({ t: 'error', code: 'SEAT_NOT_FOUND' })
  expect(rooms.size).toBe(1)
  send(host.conn, 'game.start')
  expect(vi.getTimerCount()).toBeGreaterThan(0)
  send(host.conn, 'room.destroy')
  expect(rooms.get(room.state.code)).toBeUndefined()
  expect(room.clients.size).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
  for (const peer of [host, guest, third, stage]) {
    expect(peer.messages.at(-1)).toMatchObject({ t: 'room.closed' })
  }
  const state = room.state
  send(host.conn, 'game.start')
  room.remove(host.conn.client)
  expect(room.state).toBe(state)
  expect(vi.getTimerCount()).toBe(0)
  expect(connect('Late').messages.at(-1)).toMatchObject({ t: 'error', code: 'ROOM_NOT_FOUND' })
})
