import { PROTOCOL_VERSION, type ServerMsg } from '@ud/protocol'
import { afterEach, expect, it, vi } from 'vitest'
import { Rooms } from '../src/rooms.ts'
import { type Connection, handleMessage } from '../src/socket.ts'
import { telemetry } from '../src/telemetry.ts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('shares stable room/game IDs and gates answer visibility on every player, not the stage', () => {
  vi.useFakeTimers()
  const emit = vi.spyOn(telemetry, 'emit').mockImplementation(() => {})
  const rooms = new Rooms()
  const room = rooms.create()
  const connect = (name?: string) => {
    const messages: ServerMsg[] = []
    const conn: Connection = {
      room: null,
      client: { seatId: null, isStage: false, send: (m) => messages.push(m) },
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
  const stage = connect()
  const players = ['One', 'Two', 'Three'].map(connect)
  const metadata = () => stage.messages.filter((m) => m.t === 'view').at(-1)!.view.replay!
  expect(metadata()).toMatchObject({
    roomId: room.instanceId,
    gameId: null,
    submittedAnswersVisible: false,
  })
  const consent = (conn: Connection, allowed: boolean) =>
    handleMessage(conn, rooms, JSON.stringify({ t: 'diagnostics.set', submittedAnswers: allowed }))
  consent(stage.conn, true)
  consent(players[0]!.conn, true)
  consent(players[1]!.conn, true)
  expect(metadata().submittedAnswersVisible).toBe(false)
  consent(players[2]!.conn, true)
  expect(metadata().submittedAnswersVisible).toBe(true)
  handleMessage(players[0]!.conn, rooms, JSON.stringify({ t: 'game.start' }))
  const gameId = metadata().gameId
  expect(gameId).toEqual(expect.any(String))
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'game.start', room_id: room.instanceId, game_id: gameId }),
  )
  for (const p of players)
    expect(p.messages.filter((m) => m.t === 'view').at(-1)!.view.replay?.gameId).toBe(gameId)
  consent(players[1]!.conn, false)
  expect(metadata().submittedAnswersVisible).toBe(false)
  consent(players[1]!.conn, true)
  room.remove(players[1]!.conn.client)
  expect(metadata().submittedAnswersVisible).toBe(false)
  room.broadcast()
  expect(metadata().gameId).toBe(gameId)
  expect(
    connect()
      .messages.filter((m) => m.t === 'view')
      .at(-1)!.view.replay?.gameId,
  ).toBe(gameId)
  rooms.close()
})
